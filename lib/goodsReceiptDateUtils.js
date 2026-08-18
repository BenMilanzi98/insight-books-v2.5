import { format } from 'date-fns';

/**
 * Calendar-day comparisons for receipt dates.
 * Date-only inputs (`YYYY-MM-DD`) use the local business calendar so "today"
 * in UTC+2 is not treated as yesterday relative to UTC midnight.
 */
export function utcCalendarDayMs(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function localCalendarDayMs(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function receiptCalendarDayMs(receiptDate) {
  const ymd = receiptInputToYyyyMmDd(receiptDate);
  if (ymd) {
    const [y, m, day] = ymd.split('-').map(Number);
    return new Date(y, m - 1, day).getTime();
  }
  return localCalendarDayMs(receiptDate);
}

function todayCalendarDayMs() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/**
 * Business anchor for "earliest allowed receipt date": PO document date, then record created time.
 */
export function getPurchaseOrderReceiptAnchor(po) {
  if (!po) return null;
  const raw = po.poDate ?? po.createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `yyyy-MM-dd` for date input min / display (local calendar, matches browser date picker). */
export function getPurchaseOrderMinReceiptDateStr(po) {
  const d = getPurchaseOrderReceiptAnchor(po);
  if (!d) return null;
  return format(d, 'yyyy-MM-dd');
}

function receiptInputToYyyyMmDd(receiptDateInput) {
  if (receiptDateInput == null || receiptDateInput === '') return null;
  if (typeof receiptDateInput === 'string') {
    const m = receiptDateInput.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  const d =
    receiptDateInput instanceof Date ? receiptDateInput : new Date(receiptDateInput);
  if (Number.isNaN(d.getTime())) return null;
  return format(d, 'yyyy-MM-dd');
}

/** Receipt calendar day is strictly after today's calendar day (local). */
export function isReceiptDateStrictlyAfterTodayUTC(receiptDate) {
  const todayMs = todayCalendarDayMs();
  const r = receiptCalendarDayMs(receiptDate);
  if (r == null) return false;
  return r > todayMs;
}

/** Receipt calendar day is on or before today's calendar day (local). */
export function isReceiptDateOnOrBeforeTodayUTC(receiptDate) {
  const todayMs = todayCalendarDayMs();
  const r = receiptCalendarDayMs(receiptDate);
  if (r == null) return false;
  return r <= todayMs;
}

/**
 * When a PO is linked, receipt date must not be before the PO's **order date** (`poDate`),
 * falling back to `createdAt` only if `poDate` is missing.
 */
export function assertReceiptDateOnOrAfterPurchaseOrder(receiptDateInput, purchaseOrder) {
  if (!purchaseOrder) return;
  const ordStr = getPurchaseOrderMinReceiptDateStr(purchaseOrder);
  if (!ordStr) return;
  const recStr = receiptInputToYyyyMmDd(receiptDateInput);
  if (!recStr) return;
  if (recStr < ordStr) {
    throw new Error(
      'Receipt date cannot be earlier than the purchase order date. Use the same date as the order or a later date.'
    );
  }
}
