import { resolveOrEnsureInventoryGlAccount } from '@/lib/inventoryGlAccount';
import { generateReferenceNumber } from '@/lib/journalService';
import { validateTransactionBalance } from '@/lib/accountingValidation';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';
import { postGlEntry } from '@/lib/accountingEngine/postGlEntry';

/**
 * Debit loss, credit inventory — uninsured write-off pattern.
 * Posts through centralized `postGlEntry` so balances and official GL stay in sync.
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
}) {
  const amt = Math.round(Number(amount) * 100) / 100;
  if (amt <= 0) return null;

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
  const resolvedSourceId = sourceId || sourceBatchId || null;

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

  return postGlEntry({
    tenantId,
    userId,
    entryDate,
    description: description || 'Inventory write-off',
    reference: referenceNumber,
    sourceType,
    sourceId: resolvedSourceId,
    lines: transactionLines,
    tx,
  });
}
