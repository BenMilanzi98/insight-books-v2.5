/**
 * Shared flat rows for POS daily exports (CSV / XLSX / PDF): one row per sale line item.
 */

/** @deprecated Use buildPosDailyLineItemHeadersWithCurrency for money column labels */
export const POS_DAILY_LINE_ITEM_HEADERS = [
  'Sale #',
  'Time (UTC)',
  'Item',
  'Qty',
  'Unit price',
  'Line total',
  'Sale total',
  'Payment detail',
];

/**
 * @param {string} [currencyCode]
 * @returns {string[]}
 */
export function buildPosDailyLineItemHeadersWithCurrency(currencyCode = 'MWK') {
  const c = (currencyCode || 'MWK').trim() || 'MWK';
  return [
    'Sale #',
    'Time (UTC)',
    'Item',
    'Qty',
    `Unit price (${c})`,
    `Line total (${c})`,
    `Sale total (${c})`,
    'Payment detail',
  ];
}

function isoUtc(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString();
  } catch {
    return String(iso);
  }
}

/**
 * @param {Array<{ saleNumber?: string, saleDate?: string, total?: number, primaryPaymentLabel?: string, lineItems?: Array<{ description?: string, quantity?: number, unitPrice?: number, amount?: number }> }>} transactions
 * @returns {string[][]}
 */
export function buildPosDailyLineItemDataRows(transactions) {
  const rows = [];
  for (const tx of transactions || []) {
    const time = isoUtc(tx.saleDate);
    const saleNum = String(tx.saleNumber ?? '');
    const saleTotal = String(tx.total ?? 0);
    const pay = String(tx.primaryPaymentLabel ?? '');
    const items = Array.isArray(tx.lineItems) && tx.lineItems.length > 0 ? tx.lineItems : null;

    if (!items) {
      rows.push([saleNum, time, '—', '', '', '', saleTotal, pay]);
      continue;
    }
    for (const it of items) {
      rows.push([
        saleNum,
        time,
        String(it.description ?? ''),
        String(it.quantity ?? ''),
        String(it.unitPrice ?? ''),
        String(it.amount ?? ''),
        saleTotal,
        pay,
      ]);
    }
  }
  return rows;
}
