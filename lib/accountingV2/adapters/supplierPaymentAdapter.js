/**
 * Phase 9 Stage 2 — Supplier payment → Posting Engine cutover.
 */

import { AccountingEventType, AccountingSourceModule } from '../domain/enums.js';
import {
  amountString,
  contextFromSession,
  resolveCashAccountIdForEngine,
  submitViaCutover,
  toIsoDate,
} from './baseAdapter.js';

export async function postSupplierPaymentAccounting({
  db,
  tenantId,
  userId,
  paymentId,
  paymentMethod,
  hasPermission = () => true,
  currency = 'MWK',
}) {
  const payment = await db.supplierPayment.findFirst({
    where: { id: paymentId, tenantId },
    include: { supplier: { select: { id: true, supplierName: true } } },
  });
  if (!payment) throw new Error("Source payment not found for V2 posting");

  const context = contextFromSession({
    tenantId,
    userId,
    currency: payment.currency || currency,
  });

  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.PAYABLES,
    eventType: AccountingEventType.SUPPLIER_PAYMENT_POSTED,
    hasPermission,
    buildEngineInput: async () => {
      const cashAccountId = await resolveCashAccountIdForEngine({
        db,
        context,
        tenantId,
        paymentMethod: paymentMethod || payment.paymentMethod,
        purpose: 'CASH_ON_HAND',
      });
      return {
        sourceReference: {
          sourceModule: AccountingSourceModule.PAYABLES,
          sourceType: 'SupplierPayment',
          sourceId: payment.id,
          sourceNumber: payment.paymentNumber,
          eventType: AccountingEventType.SUPPLIER_PAYMENT_POSTED,
        },
        transactionDate: toIsoDate(payment.paymentDate),
        requestedPostingDate: toIsoDate(payment.paymentDate),
        currency: payment.currency || currency,
        totalAmount: amountString(payment.totalAmount),
        taxAmount: '0.00',
        description: `Supplier payment ${payment.paymentNumber}`,
        dimensions: { supplierId: payment.supplierId },
        metadata: { cashAccountId },
        payload: null,
      };
    },
  });
}
