/**
 * Phase 9 Stage 3A — POS sale revenue → Posting Engine cutover.
 */

import { AccountingEventType, AccountingSourceModule } from '../domain/enums.js';
import {
  amountString,
  contextFromSession,
  resolveCashAccountIdForEngine,
  submitViaCutover,
  toIsoDate,
} from './baseAdapter.js';

export async function postPosSaleAccounting({
  db,
  tenantId,
  userId,
  saleId,
  saleNumber,
  saleDate,
  totalAmount,
  paymentMethod,
  /** Prefer PaymentAccount.id so cash debits the linked CoA leaf, not a name fallback. */
  paymentAccountId = null,
  taxAmount = 0,
  branchId = null,
  hasPermission = () => true,
  currency = 'MWK',
}) {
  const sale = await db.sale.findFirst({
    where: { id: saleId, tenantId },
  }).catch(() => null);

  const context = contextFromSession({
    tenantId,
    userId,
    currency,
    branchId: branchId ?? sale?.branchId ?? null,
  });

  const effectiveDate = saleDate || sale?.historicalDate || sale?.saleDate;
  const amount = totalAmount ?? sale?.totalAmount;
  const tax = taxAmount ?? sale?.taxAmount ?? 0;
  const method = paymentAccountId || paymentMethod || sale?.paymentMethod;
  const number = saleNumber || sale?.saleNumber || saleId;

  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.POINT_OF_SALE,
    eventType: AccountingEventType.INVENTORY_SOLD,
    hasPermission,
    buildEngineInput: async () => {
      const cashAccountId = await resolveCashAccountIdForEngine({
        db,
        context,
        tenantId,
        paymentMethod: method ?? null,
        purpose: 'CASH_ON_HAND',
      });
      return {
        sourceReference: {
          sourceModule: AccountingSourceModule.POINT_OF_SALE,
          // Match legacy postGlEntry identity so guards can reconcile stacks.
          sourceType: 'Sale',
          sourceId: `${saleId}-revenue`,
          sourceNumber: number,
          eventType: AccountingEventType.INVENTORY_SOLD,
        },
        transactionDate: toIsoDate(effectiveDate),
        requestedPostingDate: toIsoDate(effectiveDate),
        currency,
        totalAmount: amountString(amount),
        taxAmount: amountString(tax),
        description: `Sale ${number} - Revenue Recognition`,
        dimensions: { branchId: branchId ?? sale?.branchId ?? undefined },
        metadata: {
          saleId,
          cashAccountId,
          paymentMethod: method ?? null,
        },
        payload: null,
      };
    },
  });
}
