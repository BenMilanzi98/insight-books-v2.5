/**
 * Phase 9 Stage 3A — Goods receipt inventory → Posting Engine cutover.
 */

import { AccountingEventType, AccountingSourceModule } from '../domain/enums.js';
import { amountString, contextFromSession, submitViaCutover, toIsoDate } from './baseAdapter.js';

export async function postGoodsReceivedAccounting({
  db,
  tenantId,
  userId,
  goodsReceiptId,
  totalAmount,
  hasPermission = () => true,
  currency = 'MWK',
}) {
  const receipt = await db.goodsReceipt.findFirst({
    where: { id: goodsReceiptId, tenantId },
    include: { supplier: { select: { id: true, supplierName: true } } },
  }).catch(() => null);

  if (!receipt && !totalAmount) {
    throw new Error("Source not found for V2 posting");
  }

  const context = contextFromSession({
    tenantId,
    userId,
    currency,
  });

  const amount = totalAmount ?? receipt?.totalAmount;
  const receiptDate = receipt?.receiptDate || receipt?.createdAt || new Date();

  const { isPurchasesGrniEnabled, ensureGrniAccountExists } = await import(
    '@/lib/purchases/grniPolicy.js'
  );
  if (await isPurchasesGrniEnabled(db, tenantId)) {
    await ensureGrniAccountExists(db, tenantId);
  }

  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.PURCHASES,
    eventType: AccountingEventType.INVENTORY_RECEIVED,
    hasPermission,
    buildEngineInput: async () => ({
      sourceReference: {
        sourceModule: AccountingSourceModule.PURCHASES,
        sourceType: 'GoodsReceipt',
        sourceId: goodsReceiptId,
        sourceNumber: receipt?.receiptNumber || goodsReceiptId,
        eventType: AccountingEventType.INVENTORY_RECEIVED,
      },
      transactionDate: toIsoDate(receiptDate),
      requestedPostingDate: toIsoDate(receiptDate),
      currency,
      totalAmount: amountString(amount),
      taxAmount: '0.00',
      description: `Goods Receipt ${receipt?.receiptNumber || goodsReceiptId}`,
      dimensions: { supplierId: receipt?.supplierId },
      metadata: {},
      payload: null,
    }),
  });
}
