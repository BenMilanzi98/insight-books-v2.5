import { resolveOrEnsureInventoryGlAccount } from '@/lib/inventoryGlAccount';
import { generateReferenceNumber } from '@/lib/journalService';
import { validateTransactionBalance } from '@/lib/accountingValidation';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';

/**
 * Debit loss, credit inventory — uninsured write-off pattern.
 * Fresh-books V2: posts via postStockAdjustmentAccounting only.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 */
export async function createInventoryWriteOffJournalEntry({
  tenantId,
  userId,
  amount,
  description,
  sourceBatchId,
  sourceType = 'InventoryExpiryWriteOff',
  sourceId = null,
  tx,
  __skipCutover = false,
}) {
  const amt = Math.round(Number(amount) * 100) / 100;
  if (amt <= 0) return null;

  const resolvedSourceId = sourceId || sourceBatchId || null;

  if (!__skipCutover && resolvedSourceId) {
    const { postStockAdjustmentAccounting } = await import(
      './accountingV2/adapters/stockAdjustmentAdapter.js'
    );
    const outcome = await postStockAdjustmentAccounting({
      db: tx,
      tenantId,
      userId,
      amount: amt,
      description,
      sourceType,
      sourceId: resolvedSourceId,
      legacyPost: () =>
        createInventoryWriteOffJournalEntry({
          tenantId,
          userId,
          amount: amt,
          description,
          sourceBatchId,
          sourceType,
          sourceId: resolvedSourceId,
          tx,
          __skipCutover: true,
        }),
    });
    return outcome.result;
  }

  const settings = await tx.tenantSettings.findUnique({
    where: { tenantId },
    select: { inventoryAdjustmentLossAccountId: true },
  });

  let lossAccount =
    settings?.inventoryAdjustmentLossAccountId &&
    (await tx.account.findFirst({
      where: { id: settings.inventoryAdjustmentLossAccountId, tenantId, isActive: true },
    }));

  if (!lossAccount) {
    lossAccount = await tx.account.findFirst({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { accountName: { contains: 'Inventory Adjustment Loss', mode: 'insensitive' } },
          { accountCode: '5290' },
        ],
      },
    });
  }

  if (!lossAccount) {
    lossAccount = await tx.account.create({
      data: {
        tenantId,
        accountCode: '5290',
        accountName: 'Inventory Adjustment Loss',
        accountType: 'Expense',
        normalBalance: 'Debit',
        isActive: true,
        balance: 0,
      },
    });
  }

  const inventoryAccount = await resolveOrEnsureInventoryGlAccount(tenantId, tx);
  const entryDate = new Date();
  await assertPeriodOpen(tenantId, entryDate, tx);

  if (resolvedSourceId) {
    const existingTx = await tx.transaction.findFirst({
      where: {
        tenantId,
        sourceType,
        sourceId: resolvedSourceId,
        status: { in: ['posted', 'Posted'] },
        isReversal: false,
      },
      include: { lines: true },
    });
    if (existingTx) return existingTx;

    const legacyJournal = await tx.journalEntry.findFirst({
      where: {
        tenantId,
        sourceType,
        sourceId: resolvedSourceId,
      },
      include: { lines: true },
    });
    if (legacyJournal) return legacyJournal;
  }

  const referenceNumber = await generateReferenceNumber(tx, tenantId, entryDate);

  const transactionLines = [
    {
      lineNumber: 1,
      accountId: lossAccount.id,
      debitAmount: amt,
      creditAmount: 0,
      description: description || 'Inventory write-off (loss)',
    },
    {
      lineNumber: 2,
      accountId: inventoryAccount.id,
      debitAmount: 0,
      creditAmount: amt,
      description: description || 'Reduce inventory — write-off',
    },
  ];

  const balanceValidation = validateTransactionBalance(transactionLines);
  if (!balanceValidation.isValid) {
    throw new Error(`Transaction does not balance: ${balanceValidation.error}`);
  }

  // Fresh-books V2: legacy Transaction writer removed. V2 path is above (__skipCutover=false).
  const err = new Error(
    'createInventoryWriteOffJournalEntry legacy path removed (LEGACY_POSTING_REMOVED). Use postStockAdjustmentAccounting.'
  );
  err.code = 'LEGACY_POSTING_REMOVED';
  throw err;
}
