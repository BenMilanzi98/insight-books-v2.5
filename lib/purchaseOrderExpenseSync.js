/**
 * Legacy hook: service/mixed PO costs are NOT recorded as standalone Expense rows.
 *
 * Flow (single recognition path):
 * 1. Approve PO → no GL, no payables, no expense register rows.
 * 2. Post service receipt (or full inventory receipt for mixed) → PO becomes Received.
 * 3. createBillFromApprovedServicePO → SupplierBill + finalizeExpenseBill → Dr expense/tax, Cr AP.
 * 4. Pay via Purchases → Payments against the bill.
 *
 * Creating Expense records on approval duplicated bills/payables and defaulted paymentStatus
 * to "Fully paid" while AP was still outstanding.
 */

import prisma from './prisma';

/**
 * @returns {{ created: number, skipped: number }}
 */
export async function syncExpensesFromPurchaseOrder(_purchaseOrderId, _tenantId, _userId, _tx = prisma) {
  return { created: 0, skipped: 0 };
}
