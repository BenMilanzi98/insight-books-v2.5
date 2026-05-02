/**
 * Consistent “net sales after line discount” for reporting / profit analysis.
 * Invoice items: netAmount = pre-tax line total after discount (see invoices route).
 * Sale items: amount = qty × unitPrice (gross); discountAmount = line discount total (see sales route).
 */

/**
 * @param {{ netAmount?: unknown, quantity?: unknown, unitPrice?: unknown, discountAmount?: unknown }} item
 * @returns {number}
 */
export function invoiceItemNetRevenueExTax(item) {
  const net = Number(item?.netAmount);
  if (Number.isFinite(net) && net >= 0) return net;
  const qty = Number(item?.quantity) || 0;
  const up = Number(item?.unitPrice) || 0;
  const d = Number(item?.discountAmount) || 0;
  return Math.max(0, qty * up - d * qty);
}

/**
 * @param {{ amount?: unknown, discountAmount?: unknown }} item
 * @returns {number}
 */
export function saleItemNetRevenueExTax(item) {
  const gross = Number(item?.amount) || 0;
  const disc = Number(item?.discountAmount) || 0;
  return Math.max(0, gross - disc);
}
