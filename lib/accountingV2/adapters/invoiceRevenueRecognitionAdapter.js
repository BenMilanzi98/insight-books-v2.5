/**
 * Invoice payment-time revenue recognition → Posting Engine cutover.
 *
 * Recognizes earned revenue from deferred revenue when a customer payment is
 * received against an invoice that was initially posted to deferred revenue.
 */

import { AccountingEventType, AccountingSourceModule } from '../domain/enums.js';
import { amountString, contextFromSession, submitViaCutover, toIsoDate } from './baseAdapter.js';

export async function postInvoiceRevenueRecognitionAccounting({
  db,
  tenantId,
  userId,
  paymentId,
  invoiceId,
  recognizedNet,
  paymentDate,
  hasPermission = () => true,
  currency = 'MWK',
}) {
  if (!(Number(recognizedNet) > 0)) {
    return {
      skipped: 'recognized_net_non_positive',
      paymentId,
      invoiceId,
      recognizedNet: Number(recognizedNet ?? 0),
    };
  }

  const payment = await db.payment.findFirst({
    where: { id: paymentId, tenantId },
    include: {
      invoice: {
        select: { id: true, clientId: true, invoiceNumber: true, tenantId: true, branchId: true },
      },
    },
  });
  if (!payment) {
    throw new Error(`Invoice-Revenue payment not found: ${paymentId}`);
  }

  const linkedInvoiceId = payment.invoice?.id ?? payment.invoiceId ?? null;
  if (!linkedInvoiceId) {
    throw new Error(`Invoice-Revenue payment ${paymentId} must be linked to an invoice.`);
  }
  if (invoiceId && linkedInvoiceId !== invoiceId) {
    throw new Error(
      `Invoice-Revenue payment ${paymentId} is linked to invoice ${linkedInvoiceId}, not ${invoiceId}.`
    );
  }

  const invoice = payment?.invoice
    || await db.invoice.findFirst({
      where: { id: linkedInvoiceId, tenantId },
      select: { id: true, clientId: true, invoiceNumber: true, tenantId: true, branchId: true },
    });
  if (!invoice) {
    throw new Error(
      `Invoice-Revenue invoice ${linkedInvoiceId} could not be loaded for payment ${paymentId}.`
    );
  }

  const branchId = payment?.branchId ?? invoice?.branchId ?? null;

  const context = contextFromSession({
    tenantId,
    userId,
    currency,
    branchId,
  });

  const amount = amountString(recognizedNet);
  const effectiveDate = paymentDate || payment?.paymentDate;
  const sourceNumber = payment?.reference || invoice?.invoiceNumber || paymentId;

  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.SALES,
    eventType: AccountingEventType.INVOICE_REVENUE_RECOGNIZED,
    hasPermission,
    buildEngineInput: async () => ({
      sourceReference: {
        sourceModule: AccountingSourceModule.SALES,
        sourceType: 'Invoice-Revenue',
        sourceId: paymentId,
        sourceNumber,
        eventType: AccountingEventType.INVOICE_REVENUE_RECOGNIZED,
      },
      transactionDate: toIsoDate(effectiveDate),
      requestedPostingDate: toIsoDate(effectiveDate),
      currency,
      totalAmount: amount,
      taxAmount: '0.00',
      description: `Invoice revenue recognition${invoice?.invoiceNumber ? ` — ${invoice.invoiceNumber}` : ''}`,
      dimensions: {
        customerId: invoice?.clientId,
        branchId: branchId ?? undefined,
      },
      metadata: {
        paymentId,
        invoiceId: invoice.id,
        recognizedNet: amount,
      },
      payload: null,
    }),
  });
}
