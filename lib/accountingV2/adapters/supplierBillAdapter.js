/**
 * Phase 9 Stage 2 — Supplier bill → Posting Engine cutover.
 */

import { AccountingEventType, AccountingSourceModule } from '../domain/enums.js';
import { amountString, contextFromSession, submitViaCutover, toIsoDate } from './baseAdapter.js';

export async function postSupplierBillAccounting({
  db,
  tenantId,
  userId,
  billId,
  hasPermission = () => true,
  currency = 'MWK',
}) {
  const bill = await db.supplierBill.findFirst({
    where: { id: billId, tenantId },
    include: {
      items: true,
      supplier: { select: { id: true, supplierName: true } },
    },
  });
  if (!bill) throw new Error("Source bill not found for V2 posting");

  const context = contextFromSession({
    tenantId,
    userId,
    currency: bill.currency || currency,
  });

  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.PAYABLES,
    eventType: AccountingEventType.SUPPLIER_BILL_POSTED,
    hasPermission,
    buildEngineInput: async () => ({
      sourceReference: {
        sourceModule: AccountingSourceModule.PAYABLES,
        sourceType: 'SupplierBill',
        sourceId: bill.id,
        sourceNumber: bill.billNumber,
        eventType: AccountingEventType.SUPPLIER_BILL_POSTED,
      },
      transactionDate: toIsoDate(bill.billDate),
      requestedPostingDate: toIsoDate(bill.billDate),
      currency: bill.currency || currency,
      totalAmount: amountString(bill.totalAmount),
      taxAmount: amountString(bill.taxAmount ?? 0),
      description: `Supplier bill ${bill.billNumber} — ${bill.supplier?.supplierName || ''}`.trim(),
      dimensions: { supplierId: bill.supplierId },
      payload: null,
    }),
  });
}
