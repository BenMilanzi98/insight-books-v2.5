/**
 * Receipt payload for raw thermal printing with @madrimov/electron-pos-printer
 * (https://www.npmjs.com/package/@madrimov/electron-pos-printer).
 *
 * Install the printer library in your Electron app (not in this Next.js repo — it peers Electron):
 *   npm install @madrimov/electron-pos-printer electron
 *
 * Authenticated fetch from the renderer, then in the main process:
 *   const { buildESCPOSData, printRawData } = require('@madrimov/electron-pos-printer');
 *   const { contents, paperWidth } = await fetchJson('/api/sales/:id/receipt?format=print-data');
 *   const esc = buildESCPOSData(contents, paperWidth);
 *   await printRawData(esc, printerName);
 *
 * Optional: from the POS web app, implement window.__INSIGHT_PRINT_RECEIPT_ESC_POS__(saleId)
 * in preload to call that IPC so printReceipt() uses raw ESC/POS instead of the HTML tab.
 *
 * `paperWidth` follows TenantSettings.receiptPaperWidthMm (58–90, default 80).
 */

import { normalizeReceiptPaperWidthMm } from './receiptPaperWidth.js';

function fmtMoney(amount, currencyCode = 'MWK') {
  const n = Number(amount);
  const safe = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return `${currencyCode} ${safe.toFixed(2)}`;
  }
}

function fmtDateDDMMYYYY(date) {
  try {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
}

function fmtTime(date) {
  try {
    return new Date(date).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

/**
 * @param {{ sale: object, tenantSettings: object | null, taxData: object, paperWidth?: number }} args
 * @returns {{ paperWidth: number, contents: object[], meta: { saleId: string, saleNumber: string } }}
 */
export function buildPosReceiptEscPosContents({ sale, tenantSettings, taxData, paperWidth } = {}) {
  const normalizedPaperWidth = normalizeReceiptPaperWidthMm(
    paperWidth ?? tenantSettings?.receiptPaperWidthMm
  );
  const currency = tenantSettings?.currencyCode || 'MWK';
  const contents = [];

  contents.push({
    type: 'text',
    value: (sale.tenant?.name || 'Store').toString().toUpperCase(),
    style: { align: 'center', bold: true, size: 'double' },
  });

  if (tenantSettings?.buildingName) {
    contents.push({
      type: 'text',
      value: String(tenantSettings.buildingName),
      style: { align: 'center' },
    });
  }
  if (tenantSettings?.businessAddress) {
    contents.push({
      type: 'text',
      value: String(tenantSettings.businessAddress),
      style: { align: 'center' },
    });
  }
  if (tenantSettings?.businessCity) {
    contents.push({
      type: 'text',
      value: String(tenantSettings.businessCity),
      style: { align: 'center' },
    });
  }
  if (tenantSettings?.businessPhone) {
    contents.push({
      type: 'text',
      value: `Tel: ${tenantSettings.businessPhone}`,
      style: { align: 'center' },
    });
  }
  if (tenantSettings?.businessEmail) {
    contents.push({
      type: 'text',
      value: `Email: ${tenantSettings.businessEmail}`,
      style: { align: 'center' },
    });
  }

  contents.push({ type: 'line' });
  contents.push({
    type: 'text',
    value: `RECEIPT #${sale.saleNumber}`,
    style: { align: 'center', bold: true },
  });
  contents.push({ type: 'line' });

  if (sale.isHistorical && sale.historicalDate) {
    contents.push({
      type: 'text',
      value: 'HISTORICAL TRANSACTION',
      style: { align: 'center', bold: true },
    });
    contents.push({
      type: 'table',
      rows: [
        [
          { text: 'Sale Date' },
          {
            text: `${fmtDateDDMMYYYY(sale.historicalDate)} ${fmtTime(sale.historicalDate)}`,
            align: 'right',
          },
        ],
        [
          { text: 'Receipt Gen' },
          { text: `${fmtDateDDMMYYYY(sale.saleDate)} ${fmtTime(sale.saleDate)}`, align: 'right' },
        ],
      ],
    });
  } else {
    contents.push({
      type: 'table',
      rows: [
        [{ text: 'Date' }, { text: fmtDateDDMMYYYY(sale.saleDate), align: 'right' }],
        [{ text: 'Time' }, { text: fmtTime(sale.saleDate), align: 'right' }],
      ],
    });
  }

  contents.push({
    type: 'table',
    rows: [
      [
        { text: 'Customer' },
        { text: sale.client ? sale.client.name : 'Walk-in Customer', align: 'right' },
      ],
      [{ text: 'Cashier' }, { text: sale.createdBy?.name || '', align: 'right' }],
    ],
  });

  contents.push({
    type: 'text',
    value: 'ITEMS PURCHASED',
    style: { align: 'center', bold: true },
  });
  contents.push({ type: 'line' });

  for (const item of sale.items || []) {
    const itemQuantity = parseFloat(item.quantity || 1);
    const itemUnitPrice = parseFloat(item.unitPrice || 0);
    const itemDiscountAmount = parseFloat(item.discountAmount || 0);
    const itemSubtotal = itemQuantity * itemUnitPrice - itemDiscountAmount;

    const itemTaxes = item.itemTaxes || [];
    const itemTaxGroups = {};
    let itemTaxTotal = 0;
    for (const tax of itemTaxes) {
      const taxKey = (tax.taxName || tax.taxId || 'Tax').trim();
      const taxAmount = parseFloat(tax.taxAmount || 0);
      if (!itemTaxGroups[taxKey]) {
        itemTaxGroups[taxKey] = {
          taxName: tax.taxName || tax.taxId || 'Tax',
          taxCode: tax.taxCode,
          totalAmount: 0,
        };
      }
      itemTaxGroups[taxKey].totalAmount += taxAmount;
      itemTaxTotal += taxAmount;
    }
    if (itemTaxTotal === 0 && item.taxAmount) {
      itemTaxTotal = parseFloat(item.taxAmount || 0);
    }
    const itemTotal = itemSubtotal + itemTaxTotal;

    contents.push({
      type: 'text',
      value: String(item.description || ''),
      style: { align: 'left', bold: true },
    });
    contents.push({
      type: 'table',
      rows: [
        [
          { text: `${itemQuantity} x ${fmtMoney(itemUnitPrice, currency)}` },
          { text: fmtMoney(itemSubtotal, currency), align: 'right' },
        ],
      ],
    });
    if (itemDiscountAmount > 0) {
      contents.push({
        type: 'table',
        rows: [
          [
            { text: 'Discount' },
            { text: `-${fmtMoney(itemDiscountAmount, currency)}`, align: 'right' },
          ],
        ],
      });
    }
    if (Object.keys(itemTaxGroups).length > 0) {
      for (const g of Object.values(itemTaxGroups)) {
        contents.push({
          type: 'table',
          rows: [
            [
              { text: `${g.taxName}${g.taxCode ? ` (${g.taxCode})` : ''}` },
              { text: fmtMoney(g.totalAmount, currency), align: 'right' },
            ],
          ],
        });
      }
    } else if (itemTaxTotal > 0) {
      contents.push({
        type: 'table',
        rows: [[{ text: 'Tax' }, { text: fmtMoney(itemTaxTotal, currency), align: 'right' }]],
      });
    }
    contents.push({
      type: 'table',
      rows: [
        [
          { text: 'Item Total', bold: true },
          { text: fmtMoney(itemTotal, currency), align: 'right', bold: true },
        ],
      ],
    });
    contents.push({ type: 'line' });
  }

  contents.push({
    type: 'text',
    value: 'TOTALS',
    style: { align: 'center', bold: true },
  });
  contents.push({
    type: 'table',
    rows: [[{ text: 'Subtotal' }, { text: fmtMoney(sale.subtotal, currency), align: 'right' }]],
  });
  if (sale.totalDiscountAmount > 0) {
    contents.push({
      type: 'table',
      rows: [
        [
          { text: 'Total Discount' },
          { text: `-${fmtMoney(sale.totalDiscountAmount, currency)}`, align: 'right' },
        ],
      ],
    });
  }

  const { taxGroups, hasAnyTaxes, totalTaxAmount } = taxData;
  const positiveTaxGroups = (taxGroups || []).filter(
    (tax) => parseFloat(tax.totalAmount || 0) > 0.000001,
  );
  if (hasAnyTaxes && positiveTaxGroups.length > 0) {
    for (const tax of positiveTaxGroups) {
      contents.push({
        type: 'table',
        rows: [
          [
            { text: `${tax.taxName}${tax.taxCode ? ` (${tax.taxCode})` : ''}` },
            { text: fmtMoney(tax.totalAmount, currency), align: 'right' },
          ],
        ],
      });
    }
    contents.push({
      type: 'table',
      rows: [
        [
          { text: 'Total Tax', bold: true },
          { text: fmtMoney(totalTaxAmount, currency), align: 'right', bold: true },
        ],
      ],
    });
  } else if (parseFloat(totalTaxAmount || 0) > 0.000001) {
    contents.push({
      type: 'table',
      rows: [
        [{ text: 'Total Tax' }, { text: fmtMoney(totalTaxAmount, currency), align: 'right' }],
      ],
    });
  }

  contents.push({
    type: 'table',
    rows: [
      [
        { text: 'TOTAL', bold: true },
        { text: fmtMoney(sale.total, currency), align: 'right', bold: true },
      ],
    ],
  });

  contents.push({ type: 'line' });
  contents.push({
    type: 'text',
    value: 'PAYMENT',
    style: { align: 'center', bold: true },
  });

  const p0 = sale.payments?.[0];
  if (p0?.allocations?.length) {
    for (const alloc of p0.allocations) {
      contents.push({
        type: 'table',
        rows: [
          [
            { text: alloc.paymentAccount?.name || 'Payment' },
            { text: fmtMoney(alloc.amount, currency), align: 'right' },
          ],
        ],
      });
    }
    contents.push({
      type: 'table',
      rows: [
        [
          { text: 'Total Paid', bold: true },
          { text: fmtMoney(p0.amount, currency), align: 'right', bold: true },
        ],
      ],
    });
  } else {
    const method =
      sale.paymentMethod || p0?.allocations?.[0]?.paymentAccount?.name || 'N/A';
    contents.push({
      type: 'text',
      value: `Payment: ${method}`,
      style: { align: 'center' },
    });
  }

  if (sale.posAmountTendered != null) {
    contents.push({
      type: 'table',
      rows: [
        [
          { text: 'Amount tendered' },
          { text: fmtMoney(sale.posAmountTendered, currency), align: 'right' },
        ],
        [
          { text: 'Change', bold: true },
          {
            text: fmtMoney(sale.posChangeGiven != null ? sale.posChangeGiven : 0, currency),
            align: 'right',
            bold: true,
          },
        ],
      ],
    });
  }
  if (sale.notes) {
    contents.push({
      type: 'text',
      value: `Notes: ${sale.notes}`,
      style: { align: 'left' },
    });
  }

  contents.push({ type: 'line' });
  const footerMsg = tenantSettings?.receiptFooter || 'Thank you for your business!';
  contents.push({ type: 'text', value: footerMsg, style: { align: 'center' } });

  if (sale.footerPhoneOverride) {
    contents.push({
      type: 'text',
      value: `Tel: ${sale.footerPhoneOverride}`,
      style: { align: 'center' },
    });
  } else if (tenantSettings?.businessPhone) {
    contents.push({
      type: 'text',
      value: `Tel: ${tenantSettings.businessPhone}`,
      style: { align: 'center' },
    });
  }

  if (sale.footerBankDetailsOverride) {
    contents.push({
      type: 'text',
      value: String(sale.footerBankDetailsOverride),
      style: { align: 'center' },
    });
  } else if (tenantSettings?.defaultBankDetails) {
    contents.push({
      type: 'text',
      value: String(tenantSettings.defaultBankDetails),
      style: { align: 'center' },
    });
  }

  contents.push({
    type: 'text',
    value: `${new Date().getFullYear()} © ${sale.tenant?.name || ''} | insightbooksafrica.com`,
    style: { align: 'center' },
  });

  contents.push({ type: 'feed', lines: 2 });
  contents.push({ type: 'cut' });

  return {
    paperWidth: normalizedPaperWidth,
    contents,
    meta: { saleId: sale.id, saleNumber: String(sale.saleNumber || '') },
  };
}
