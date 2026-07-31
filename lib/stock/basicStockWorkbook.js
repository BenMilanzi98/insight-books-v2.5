/**
 * Four-column basic stock Excel template / parse / export (ExcelJS + xlsx read).
 * Columns: Item Name | Quantity | Order Price | Selling Price
 */

import crypto from 'crypto';
import { parseMoney } from '../money.js';
import { validateItemName } from './itemNameNormalization.js';

export const BASIC_STOCK_COLUMNS = Object.freeze([
  'Item Name',
  'Quantity',
  'Order Price',
  'Selling Price',
]);

const HEADER_ALIASES = Object.freeze({
  'item name': 'Item Name',
  itemname: 'Item Name',
  name: 'Item Name',
  quantity: 'Quantity',
  qty: 'Quantity',
  'order price': 'Order Price',
  orderprice: 'Order Price',
  cost: 'Order Price',
  'selling price': 'Selling Price',
  sellingprice: 'Selling Price',
  price: 'Selling Price',
});

function cellText(value) {
  if (value == null) return '';
  if (typeof value === 'object' && value.result != null) return String(value.result).trim();
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function normalizeHeader(h) {
  const key = String(h || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ');
  return HEADER_ALIASES[key] || HEADER_ALIASES[key.replace(/\s/g, '')] || null;
}

/**
 * @param {Buffer|ArrayBuffer|Uint8Array} buffer
 */
export async function parseBasicStockWorkbook(buffer) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false });
  if (!wb.SheetNames?.length) {
    throw Object.assign(new Error('Workbook has no worksheets.'), { code: 'EMPTY_WORKBOOK' });
  }
  if (wb.SheetNames.length > 1) {
    // Allow multi-sheet but only read the first for simplicity; warn via flag.
  }
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  if (!rows.length) {
    throw Object.assign(new Error('Worksheet is empty.'), { code: 'EMPTY_WORKBOOK' });
  }

  const headerRow = rows[0].map(cellText);
  const mapped = headerRow.map(normalizeHeader);
  const missing = BASIC_STOCK_COLUMNS.filter((c) => !mapped.includes(c));
  if (missing.length) {
    throw Object.assign(
      new Error(`Missing required columns: ${missing.join(', ')}. Expected exactly: ${BASIC_STOCK_COLUMNS.join(', ')}.`),
      { code: 'MISSING_STOCK_IMPORT_COLUMN', missing }
    );
  }

  const idx = Object.fromEntries(BASIC_STOCK_COLUMNS.map((c) => [c, mapped.indexOf(c)]));
  const parsed = [];
  for (let r = 1; r < rows.length; r += 1) {
    const line = rows[r] || [];
    const itemName = cellText(line[idx['Item Name']]);
    const quantityRaw = cellText(line[idx.Quantity]);
    const orderPriceRaw = cellText(line[idx['Order Price']]);
    const sellingPriceRaw = cellText(line[idx['Selling Price']]);
    if (!itemName && !quantityRaw && !orderPriceRaw && !sellingPriceRaw) continue;

    // Example template row
    if (/^example$/i.test(itemName) || /^example\b/i.test(itemName)) {
      parsed.push({
        rowNumber: r + 1,
        skip: true,
        reason: 'EXAMPLE_ROW',
        itemName,
      });
      continue;
    }

    parsed.push({
      rowNumber: r + 1,
      skip: false,
      itemName,
      quantityRaw,
      orderPriceRaw,
      sellingPriceRaw,
    });
  }

  const fileHash = crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
  return { sheetName: wb.SheetNames[0], rows: parsed, fileHash, multiSheet: wb.SheetNames.length > 1 };
}

/**
 * @param {Array<{itemName:string,quantity:number,orderPrice:number,sellingPrice:number}>} rows
 */
export async function buildBasicStockWorkbookBuffer(rows, { includeExample = false } = {}) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Stock');
  ws.columns = BASIC_STOCK_COLUMNS.map((h) => ({ header: h, key: h, width: 18 }));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: BASIC_STOCK_COLUMNS.length },
  };

  if (includeExample) {
    ws.addRow(['Example Cooking Oil', 10, 100, 150]);
    ws.getRow(2).font = { italic: true, color: { argb: 'FF666666' } };
  }

  for (const row of rows || []) {
    const values = [
      String(row.itemName ?? ''),
      Number(row.quantity ?? 0),
      Number(row.orderPrice ?? 0),
      Number(row.sellingPrice ?? 0),
    ];
    // Prevent formula injection
    if (typeof values[0] === 'string' && /^[=+\-@]/.test(values[0])) {
      values[0] = `'${values[0]}`;
    }
    const excelRow = ws.addRow(values);
    excelRow.getCell(2).numFmt = '#,##0.####';
    excelRow.getCell(3).numFmt = '#,##0.00';
    excelRow.getCell(4).numFmt = '#,##0.00';
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * Validate a parsed raw row into a typed preview row (no DB).
 */
export function validateBasicStockRawRow(raw) {
  if (raw.skip) {
    return { ...raw, status: 'SKIPPED', matchStatus: 'INVALID', errors: [], warnings: [] };
  }

  const errors = [];
  const warnings = [];
  const name = validateItemName(raw.itemName);
  if (!name.ok) errors.push({ code: name.code, message: name.message });

  const quantity = Number(String(raw.quantityRaw).replace(/,/g, ''));
  if (raw.quantityRaw === '' || !Number.isFinite(quantity)) {
    errors.push({ code: 'INVALID_QUANTITY', message: 'Quantity must be a number.' });
  } else if (quantity <= 0) {
    errors.push({ code: 'INVALID_QUANTITY', message: 'Quantity must be greater than zero.' });
  }

  const orderPrice = parseMoney(raw.orderPriceRaw);
  if (raw.orderPriceRaw === '' || !Number.isFinite(Number(String(raw.orderPriceRaw).replace(/,/g, '')))) {
    errors.push({ code: 'INVALID_ORDER_PRICE', message: 'Order Price must be a number.' });
  } else if (orderPrice < 0) {
    errors.push({ code: 'INVALID_ORDER_PRICE', message: 'Order Price must be zero or greater.' });
  }

  const sellingPrice = parseMoney(raw.sellingPriceRaw);
  if (raw.sellingPriceRaw === '' || !Number.isFinite(Number(String(raw.sellingPriceRaw).replace(/,/g, '')))) {
    errors.push({ code: 'INVALID_SELLING_PRICE', message: 'Selling Price must be a number.' });
  } else if (sellingPrice < 0) {
    errors.push({ code: 'INVALID_SELLING_PRICE', message: 'Selling Price must be zero or greater.' });
  }

  if (errors.length === 0 && sellingPrice < orderPrice) {
    warnings.push({ code: 'SELLING_BELOW_ORDER', message: 'Selling Price is below Order Price.' });
  }
  if (errors.length === 0 && sellingPrice === 0) {
    warnings.push({ code: 'ZERO_SELLING_PRICE', message: 'Selling Price is zero.' });
  }

  return {
    rowNumber: raw.rowNumber,
    itemName: name.ok ? name.displayName : String(raw.itemName || '').trim(),
    normalizedName: name.ok ? name.normalizedName : '',
    quantity: Number.isFinite(quantity) ? quantity : null,
    orderPrice: Number.isFinite(orderPrice) ? orderPrice : null,
    sellingPrice: Number.isFinite(sellingPrice) ? sellingPrice : null,
    status: errors.length ? 'INVALID' : warnings.length ? 'WARNING' : 'VALID',
    matchStatus: errors.length ? 'INVALID' : 'PENDING',
    errors,
    warnings,
  };
}
