/**
 * Phase 9 Stage 3B — Customer invoice refund → Posting Engine cutover.
 */

import { AccountingEventType, AccountingSourceModule } from '../domain/enums.js';
import {
  amountString,
  contextFromSession,
  resolveCashAccountIdForEngine,
  submitViaCutover,
  toIsoDate,
} from './baseAdapter.js';

export async function postCustomerRefundAccounting({
  db,
  tenantId,
  userId,
  refundId,
  invoiceId,
  refundAmount,
  refundDate,
  paymentMethod = null,
  cashAccountId = null,
  hasPermission = () => true,
  currency = 'MWK',
}) {
  const refund = await db.invoiceRefund.findFirst({
    where: { id: refundId, tenantId },
    include: {
      invoice: { select: { id: true, clientId: true, invoiceNumber: true } },
    },
  }).catch(() => null);

  const invoice = refund?.invoice
    || (invoiceId
      ? await db.invoice.findFirst({
          where: { id: invoiceId, tenantId },
          select: { id: true, clientId: true, invoiceNumber: true },
        }).catch(() => null)
      : null);

  const context = contextFromSession({ tenantId, userId, currency });

  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.RECEIVABLES,
    eventType: AccountingEventType.CUSTOMER_REFUND_POSTED,
    hasPermission,
    buildEngineInput: async () => {
      let cashId = cashAccountId;
      if (!cashId) {
        cashId = await resolveCashAccountIdForEngine({
          db,
          context,
          tenantId,
          paymentMethod,
          purpose: 'CASH_ON_HAND',
        });
      }
      return {
        sourceReference: {
          sourceModule: AccountingSourceModule.RECEIVABLES,
          sourceType: 'InvoiceRefund',
          sourceId: refundId,
          sourceNumber: invoice?.invoiceNumber || refundId,
          eventType: AccountingEventType.CUSTOMER_REFUND_POSTED,
        },
        transactionDate: toIsoDate(refundDate || refund?.refundDate || new Date()),
        requestedPostingDate: toIsoDate(refundDate || refund?.refundDate || new Date()),
        currency,
        totalAmount: amountString(refundAmount ?? refund?.refundAmount),
        taxAmount: '0.00',
        description: `Refund for Invoice ${invoice?.invoiceNumber || invoiceId}`,
        dimensions: { customerId: invoice?.clientId },
        metadata: {
          cashAccountId: cashId,
          invoiceId: invoice?.id ?? invoiceId,
        },
        payload: null,
      };
    },
  });
}
