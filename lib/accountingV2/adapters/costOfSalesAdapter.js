/**
 * Phase 9 Stage 3A — Cost of sales → Posting Engine cutover.
 *
 * Single entry for POS bundled COGS, `/api/cogs/sale`, and invoice COGS.
 * Idempotency: Sale-COGS|Invoice-COGS + document id (matches legacy source keys).
 */

import { AccountingEventType, AccountingSourceModule } from '../domain/enums.js';
import { amountString, contextFromSession, submitViaCutover, toIsoDate } from './baseAdapter.js';

/**
 * @param {'Sale'|'Invoice'} documentKind
 */
export async function postCostOfSalesAccounting({
  db,
  tenantId,
  userId,
  documentKind = 'Sale',
  documentId,
  documentNumber = null,
  documentDate = null,
  cogsAmount,
  branchId = null,
  hasPermission = () => true,
  currency = 'MWK',
}) {
  const isInvoice = documentKind === 'Invoice';
  let doc = null;
  if (isInvoice) {
    doc = await db.invoice.findFirst({
      where: { id: documentId, tenantId },
      select: { id: true, invoiceNumber: true, issueDate: true, branchId: true },
    }).catch(() => null);
  } else {
    doc = await db.sale.findFirst({
      where: { id: documentId, tenantId },
      select: {
        id: true,
        saleNumber: true,
        saleDate: true,
        historicalDate: true,
        branchId: true,
      },
    }).catch(() => null);
  }

  const context = contextFromSession({
    tenantId,
    userId,
    currency,
    branchId: branchId ?? doc?.branchId ?? null,
  });

  const sourceType = isInvoice ? 'Invoice-COGS' : 'Sale-COGS';
  const number =
    documentNumber
    || doc?.saleNumber
    || doc?.invoiceNumber
    || documentId;
  const effectiveDate =
    documentDate
    || doc?.historicalDate
    || doc?.saleDate
    || doc?.issueDate;

  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.INVENTORY,
    eventType: AccountingEventType.COST_OF_SALES_RECOGNIZED,
    hasPermission,
    buildEngineInput: async () => ({
      sourceReference: {
        sourceModule: AccountingSourceModule.INVENTORY,
        sourceType,
        sourceId: documentId,
        sourceNumber: number,
        eventType: AccountingEventType.COST_OF_SALES_RECOGNIZED,
      },
      transactionDate: toIsoDate(effectiveDate),
      requestedPostingDate: toIsoDate(effectiveDate),
      currency,
      totalAmount: amountString(cogsAmount),
      taxAmount: '0.00',
      description: `${isInvoice ? 'Invoice' : 'Sale'} ${number} - COGS Recognition`,
      dimensions: { branchId: branchId ?? doc?.branchId ?? undefined },
      metadata: {
        documentKind,
        documentId,
        costAmount: amountString(cogsAmount),
        valuationMethod: 'FIFO_OR_PRODUCT_COST',
      },
      payload: null,
    }),
  });
}
