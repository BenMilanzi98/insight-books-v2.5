/**
 * Phase 9 Stage 3A — Stock write-off / adjustment → Posting Engine cutover.
 */

import { AccountingEventType, AccountingSourceModule } from '../domain/enums.js';
import { amountString, contextFromSession, submitViaCutover, toIsoDate } from './baseAdapter.js';

export async function postStockAdjustmentAccounting({
  db,
  tenantId,
  userId,
  amount,
  description,
  sourceType = 'InventoryExpiryWriteOff',
  sourceId,
  lossAccountId = null,
  hasPermission = () => true,
  currency = 'MWK',
}) {
  const context = contextFromSession({ tenantId, userId, currency });

  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.INVENTORY,
    eventType: AccountingEventType.STOCK_ADJUSTMENT_POSTED,
    hasPermission,
    buildEngineInput: async () => ({
      sourceReference: {
        sourceModule: AccountingSourceModule.INVENTORY,
        sourceType,
        sourceId: sourceId || `adj-${Date.now()}`,
        sourceNumber: sourceId,
        eventType: AccountingEventType.STOCK_ADJUSTMENT_POSTED,
      },
      transactionDate: toIsoDate(new Date()),
      requestedPostingDate: toIsoDate(new Date()),
      currency,
      totalAmount: amountString(amount),
      taxAmount: '0.00',
      description: description || 'Inventory write-off',
      dimensions: {},
      metadata: { lossAccountId, amount: amountString(amount) },
      payload: null,
    }),
  });
}
