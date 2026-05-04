/**
 * Consistent net sales after line discount for reporting / profit analysis.
 * Invoice items: netAmount = pre-tax line total after discount (see invoices route).
 * Sale items: amount = qty * unitPrice; discountAmount = line discount total (see sales route).
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

export function roundReportAmount(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function invoiceNetRevenueTotalExTax(invoice) {
  const lineTotal = (invoice?.items || []).reduce(
    (sum, item) => sum + invoiceItemNetRevenueExTax(item),
    0
  );
  if (lineTotal > 0) return roundReportAmount(lineTotal);

  const subtotal = Number(invoice?.subtotal);
  if (Number.isFinite(subtotal) && subtotal >= 0) return roundReportAmount(subtotal);

  const total = Number(invoice?.total) || 0;
  const tax = Number(invoice?.taxAmount) || 0;
  return roundReportAmount(Math.max(0, total - tax));
}

export function saleNetRevenueTotalExTax(sale) {
  const lineTotal = (sale?.items || []).reduce(
    (sum, item) => sum + saleItemNetRevenueExTax(item),
    0
  );
  if (lineTotal > 0) return roundReportAmount(lineTotal);

  const subtotal = Number(sale?.subtotal);
  const discount = Number(sale?.discount || sale?.totalDiscountAmount || 0) || 0;
  if (Number.isFinite(subtotal) && subtotal >= 0) {
    return roundReportAmount(Math.max(0, subtotal - discount));
  }

  const total = Number(sale?.total) || 0;
  const tax = Number(sale?.totalTaxAmount ?? sale?.taxAmount ?? 0) || 0;
  return roundReportAmount(Math.max(0, total - tax));
}

export function invoiceDocumentTaxAmount(invoice) {
  return roundReportAmount(Number(invoice?.taxAmount) || 0);
}

export function saleDocumentTaxAmount(sale) {
  const headerTax = Number(sale?.totalTaxAmount ?? sale?.taxAmount);
  if (Number.isFinite(headerTax) && headerTax >= 0) return roundReportAmount(headerTax);
  return roundReportAmount(
    (sale?.items || []).reduce((sum, item) => sum + (Number(item?.taxAmount) || 0), 0)
  );
}
