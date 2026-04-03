/**
 * Calendar-day comparisons in UTC so `YYYY-MM-DD` receipt dates behave predictably.
 */
export function utcCalendarDayMs(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Receipt calendar day is strictly after today's calendar day (UTC). */
export function isReceiptDateStrictlyAfterTodayUTC(receiptDate) {
  const now = new Date();
  const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const r = utcCalendarDayMs(receiptDate);
  if (r == null) return false;
  return r > todayMs;
}

/** Receipt calendar day is on or before today's calendar day (UTC). */
export function isReceiptDateOnOrBeforeTodayUTC(receiptDate) {
  const now = new Date();
  const todayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const r = utcCalendarDayMs(receiptDate);
  if (r == null) return false;
  return r <= todayMs;
}

/**
 * When a PO is linked, receipt date (calendar) must not be before the order's created date (calendar).
 */
export function assertReceiptDateOnOrAfterPurchaseOrder(receiptDateInput, purchaseOrder) {
  if (!purchaseOrder?.createdAt) return;
  const rec = utcCalendarDayMs(receiptDateInput instanceof Date ? receiptDateInput : new Date(receiptDateInput));
  const ord = utcCalendarDayMs(purchaseOrder.createdAt);
  if (rec == null || ord == null) return;
  if (rec < ord) {
    throw new Error(
      'Receipt date cannot be earlier than the purchase order date. Use the same date as the order or a later date.'
    );
  }
}
