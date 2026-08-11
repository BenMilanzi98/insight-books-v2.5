/**
 * Phase 9 Stage 2 — Customer payment → Posting Engine cutover.
 */

import { AccountingEventType, AccountingSourceModule } from '../domain/enums.js';
import {
  amountString,
  contextFromSession,
  resolveCashAccountIdForEngine,
  submitViaCutover,
  toIsoDate,
} from './baseAdapter.js';

export async function postCustomerPaymentAccounting({
  db,
  tenantId,
  userId,
  paymentId,
  invoiceId,
  paymentAmount,
  paymentDate,
  paymentMethod,
  hasPermission = () => true,
  currency = 'MWK',
}) {
  const payment = await db.payment.findFirst({
    where: { id: paymentId, tenantId },
    include: {
      invoice: {
        select: { id: true, clientId: true, invoiceNumber: true, branchId: true },
      },
    },
  });
  const invoice = payment?.invoice
    || (invoiceId
      ? await db.invoice.findFirst({
          where: { id: invoiceId, tenantId },
          select: { id: true, clientId: true, invoiceNumber: true, branchId: true },
        })
      : null);

  const branchId = payment?.branchId ?? invoice?.branchId ?? null;

  const context = contextFromSession({
    tenantId,
    userId,
    currency,
    branchId,
  });

  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.RECEIVABLES,
    eventType: AccountingEventType.CUSTOMER_PAYMENT_POSTED,
    hasPermission,
    buildEngineInput: async () => {
      const cashAccountId = await resolveCashAccountIdForEngine({
        db,
        context,
        tenantId,
        paymentMethod: paymentMethod || payment?.paymentMethod,
        purpose: 'CASH_ON_HAND',
      });
      return {
        sourceReference: {
          sourceModule: AccountingSourceModule.RECEIVABLES,
          sourceType: 'Payment',
          sourceId: paymentId,
          sourceNumber: payment?.reference || paymentId,
          eventType: AccountingEventType.CUSTOMER_PAYMENT_POSTED,
        },
        transactionDate: toIsoDate(paymentDate || payment?.paymentDate),
        requestedPostingDate: toIsoDate(paymentDate || payment?.paymentDate),
        currency,
        totalAmount: amountString(paymentAmount ?? payment?.amount),
        taxAmount: '0.00',
        description: `Customer payment${invoice?.invoiceNumber ? ` — ${invoice.invoiceNumber}` : ''}`,
        dimensions: {
          customerId: invoice?.clientId,
          branchId: branchId ?? undefined,
        },
        metadata: { cashAccountId, invoiceId: invoice?.id ?? null },
        payload: null,
      };
    },
  });
}
