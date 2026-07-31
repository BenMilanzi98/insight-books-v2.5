import { getColumnValue } from './csv.js';
import { isFutureDate, parseImportDate, toDateOnlyString } from './dates.js';
import { addMoney, multiplyMoney, percentOfMoney, roundMoney } from '../money.js';

export const VALID_PAYMENT_METHODS = Object.freeze([
  'cash',
  'card',
  'bank_transfer',
  'airtel_money',
  'mpamba',
  'paychangu',
  'cheque',
  'mobile_money',
]);

export function normalizePaymentMethod(method) {
  if (!method) return 'cash';
  const methodStr = String(method).trim();
  if (!methodStr) return 'cash';
  const map = {
    cash: 'cash',
    card: 'card',
    'bank transfer': 'bank_transfer',
    banktransfer: 'bank_transfer',
    bank_transfer: 'bank_transfer',
    'airtel money': 'airtel_money',
    airtelmoney: 'airtel_money',
    airtel_money: 'airtel_money',
    mpamba: 'mpamba',
    'tnm mpamba': 'mpamba',
    paychangu: 'paychangu',
    'pay changu': 'paychangu',
    cheque: 'cheque',
    check: 'cheque',
    'mobile money': 'mobile_money',
    mobile_money: 'mobile_money',
  };
  const key = methodStr.toLowerCase().replace(/\s+/g, ' ');
  if (map[key]) return map[key];
  const underscored = methodStr.toLowerCase().replace(/\s+/g, '_');
  if (VALID_PAYMENT_METHODS.includes(underscored)) return underscored;
  return underscored;
}

function parseNumericValue(value) {
  if (value === undefined || value === null) return '';
  const str = String(value).trim();
  if (!str) return '';
  return str.replace(/[$,\s]/g, '');
}

/**
 * Validate one CSV row into a normalized import row (or errors).
 * @param {Record<string, unknown>} row
 * @param {number} rowNumber
 */
export function validateImportRow(row, rowNumber = row?.rowNumber || 0) {
  const errors = [];

  const dateRaw = getColumnValue(row, ['date', 'Transaction Date', 'Sale Date', 'Recorded Date']);
  const reference = String(
    getColumnValue(row, ['reference', 'Original Reference', 'Reference']) || ''
  ).trim();
  const customer = String(
    getColumnValue(row, ['customer', 'Customer Name', 'Client Name']) || ''
  ).trim();
  const description = String(
    getColumnValue(row, [
      'description',
      'Product/Service Description',
      'Product Description',
      'Item',
    ]) || ''
  ).trim();
  const qtyRaw = getColumnValue(row, ['qty', 'Quantity', 'Qty']);
  const priceRaw = getColumnValue(row, ['unit_price', 'Selling Price', 'Price', 'UnitPrice']);
  const taxRaw = getColumnValue(row, ['tax_percent', 'Tax Rate (%)', 'Tax Rate', 'Tax %']) || '0';
  const paymentRaw = getColumnValue(row, ['payment_method', 'Payment Method', 'Payment']) || 'cash';
  const notes = String(getColumnValue(row, ['notes', 'Note', 'Remarks']) || '').trim();

  const parsedDate = parseImportDate(dateRaw);
  if (!dateRaw || String(dateRaw).trim() === '') {
    errors.push('date is required (use YYYY-MM-DD or DD/MM/YYYY)');
  } else if (!parsedDate) {
    errors.push(`invalid date "${dateRaw}" — use YYYY-MM-DD or DD/MM/YYYY`);
  } else if (isFutureDate(parsedDate)) {
    errors.push('date cannot be in the future');
  }

  if (!description) {
    errors.push('description is required');
  }

  const qtyStr = parseNumericValue(qtyRaw);
  const qty = parseFloat(qtyStr);
  if (!qtyStr || Number.isNaN(qty) || qty <= 0) {
    errors.push('qty must be a number greater than 0');
  }

  const priceStr = parseNumericValue(priceRaw);
  const unitPrice = parseFloat(priceStr);
  if (priceRaw === undefined) {
    errors.push('unit_price column is missing');
  } else if (!priceStr || Number.isNaN(unitPrice) || unitPrice < 0) {
    errors.push('unit_price must be a number >= 0');
  }

  const taxStr = parseNumericValue(taxRaw) || '0';
  const taxPercent = parseFloat(taxStr);
  if (Number.isNaN(taxPercent) || taxPercent < 0) {
    errors.push('tax_percent must be a number >= 0');
  }

  const paymentMethod = normalizePaymentMethod(paymentRaw);
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    errors.push(
      `payment_method must be one of: ${VALID_PAYMENT_METHODS.join(', ')} (got "${paymentRaw}")`
    );
  }

  if (errors.length) {
    return { ok: false, rowNumber, errors };
  }

  const subtotal = multiplyMoney(qty, unitPrice);
  const taxAmount = percentOfMoney(subtotal, taxPercent);
  const total = roundMoney(addMoney(subtotal, taxAmount));

  return {
    ok: true,
    rowNumber,
    errors: [],
    data: {
      rowNumber,
      date: parsedDate,
      dateOnly: toDateOnlyString(parsedDate),
      reference: reference || null,
      customer: customer || null,
      description,
      qty,
      unitPrice,
      taxPercent,
      taxAmount,
      subtotal,
      total,
      paymentMethod,
      notes: notes || null,
    },
  };
}

/**
 * Build preview payload from parsed CSV rows.
 * @param {Array<Record<string, unknown>>} rows
 */
export function buildImportPreview(rows) {
  const valid = [];
  const invalid = [];

  for (const row of rows) {
    const result = validateImportRow(row, row.rowNumber);
    if (result.ok) {
      valid.push(result.data);
    } else {
      invalid.push({
        rowNumber: result.rowNumber,
        errors: result.errors,
      });
    }
  }

  const dates = valid.map((r) => r.dateOnly).filter(Boolean).sort();
  const totalAmount = valid.reduce((s, r) => addMoney(s, r.total), 0);

  return {
    totalRows: rows.length,
    validCount: valid.length,
    invalidCount: invalid.length,
    dateFrom: dates[0] || null,
    dateTo: dates[dates.length - 1] || null,
    totalAmount,
    validRows: valid,
    invalidRows: invalid,
    stockImpact: 'NONE',
    note: 'Historical import records past sales and accounting. Stock on hand is not changed.',
  };
}
