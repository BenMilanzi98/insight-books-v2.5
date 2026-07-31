/**
 * Post expense-type supplier bills to the GL (Dr expense/tax, Cr AP).
 * Shared by manual bill creation and PO-from-receipt automation.
 * V2-only: posts through postSupplierBillAccounting / executePosting.
 */

import { postSupplierBillAccounting } from '@/lib/accountingV2/adapters/supplierBillAdapter.js';

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {object} bill - must include supplier: { supplierName }, items[]
 * @param {string} tenantId
 * @param {string} userId
 */
export async function finalizeExpenseBill(tx, bill, tenantId, userId) {
  if (bill.journalEntryId) return;

  const outcome = await postSupplierBillAccounting({
    db: tx,
    tenantId,
    userId,
    billId: bill.id,
    currency: bill.currency || 'MWK',
  });

  const journalId = outcome.result?.journalEntryId;
  if (journalId) {
    await tx.supplierBill.update({
      where: { id: bill.id },
      data: { journalEntryId: journalId },
    });
  }
  await tx.supplier.update({
    where: { id: bill.supplierId },
    data: { currentBalance: { increment: bill.totalAmount } },
  });
  return outcome.result;
}
