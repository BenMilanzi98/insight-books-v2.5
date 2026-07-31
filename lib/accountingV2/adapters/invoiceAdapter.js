/**
 * Phase 9 Stage 2 — Customer invoice → Posting Engine cutover.
 */

import { AccountingEventType, AccountingSourceModule } from '../domain/enums.js';
import { amountString, contextFromSession, submitViaCutover, toIsoDate } from './baseAdapter.js';

export async function postInvoiceAccounting({
  db,
  tenantId,
  userId,
  invoiceId,
  hasPermission = () => true,
  currency = 'MWK',
}) {
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: { client: { select: { id: true } } },
  });
  if (!invoice) {
    throw new Error("Source not found for V2 posting");
  }

  const context = contextFromSession({
    tenantId,
    userId,
    currency: invoice.currency || currency,
    branchId: invoice.branchId,
  });

  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.SALES,
    eventType: AccountingEventType.INVOICE_POSTED,
    hasPermission,
    buildEngineInput: async () => ({
      sourceReference: {
        sourceModule: AccountingSourceModule.SALES,
        sourceType: 'Invoice',
        sourceId: invoice.id,
        sourceNumber: invoice.invoiceNumber,
        eventType: AccountingEventType.INVOICE_POSTED,
      },
      transactionDate: toIsoDate(invoice.issueDate),
      requestedPostingDate: toIsoDate(invoice.issueDate),
      currency: invoice.currency || currency,
      totalAmount: amountString(invoice.total),
      taxAmount: amountString(invoice.taxAmount ?? 0),
      description: `Customer invoice ${invoice.invoiceNumber}`,
      dimensions: {
        customerId: invoice.clientId,
        branchId: invoice.branchId ?? undefined,
      },
      payload: null,
    }),
  });
}
