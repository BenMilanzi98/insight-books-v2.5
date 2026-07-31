import prisma from '@/lib/prisma.js';
import { postGlEntry } from '@/lib/accountingEngine/postGlEntry.js';
import { getPaymentAccount } from '@/lib/transactionJournalHelpers.js';
import { resolvePrimaryCapitalAccount } from '@/lib/resolveCapitalAccount.js';
import { assertPeriodOpen } from '@/lib/accountingPeriodService.js';
import { generateReferenceNumber } from '@/lib/journalService.js';
import { parseMoney } from '@/lib/money.js';

/**
 * Resolve a payment route side to a postable GL Account (capital/equity, asset, or mapped cash/bank).
 */
export async function resolvePaymentSideGlAccount(tenantId, accountKey, tx = prisma) {
  if (!accountKey) return null;
  const key = String(accountKey).trim();

  if (key.length > 20 && /^[a-z0-9]+$/i.test(key)) {
    const glAccount = await tx.account.findFirst({
      where: { id: key, tenantId, isActive: true },
    });
    if (glAccount) return glAccount;
  }

  return getPaymentAccount(tenantId, key, tx);
}

/**
 * Post transfer between capital/cash/bank GL accounts for a payment row.
 */
export async function postPaymentTransferGlEntry({
  tenantId,
  userId,
  paymentId,
  amount,
  paymentDate,
  sourceAccount,
  destinationAccount,
  notes,
  tx = null,
}) {
  const numericAmount = parseMoney(amount);
  if (!tenantId || !userId || !paymentId || !numericAmount || numericAmount <= 0) {
    return null;
  }

  const db = tx || prisma;
  const fromGl = await resolvePaymentSideGlAccount(tenantId, sourceAccount, db);
  const toGl = await resolvePaymentSideGlAccount(tenantId, destinationAccount, db);
  if (!fromGl || !toGl) return null;

  const entryDate = paymentDate instanceof Date ? paymentDate : new Date(paymentDate || Date.now());
  await assertPeriodOpen(tenantId, entryDate, db);
  const reference = await generateReferenceNumber(db, tenantId, entryDate);

  const lines = [
    {
      lineNumber: 1,
      accountId: toGl.id,
      debitAmount: numericAmount,
      creditAmount: 0,
      description: 'Transfer in',
    },
    {
      lineNumber: 2,
      accountId: fromGl.id,
      debitAmount: 0,
      creditAmount: numericAmount,
      description: 'Transfer out',
    },
  ];
  const desc = notes?.trim() || 'Payment transfer';
  const { postBankTransferAccounting } = await import(
    './accountingV2/adapters/remainingAdapters.js'
  );
  const outcome = await postBankTransferAccounting({
    db,
    tenantId,
    userId,
    sourceType: 'Transfer',
    sourceId: paymentId,
    amount: numericAmount,
    date: entryDate,
    description: desc,
    fromAccountId: fromGl.id,
    toAccountId: toGl.id,
    lines,
    legacyPost: () =>
      postGlEntry({
        tenantId,
        userId,
        entryDate,
        description: desc,
        reference,
        sourceType: 'Transfer',
        sourceId: paymentId,
        lines,
        tx,
      }),
  });
  return outcome.result;
}

/**
 * Post cash balance adjustment (Dr cash/bank, Cr owner capital) for a payment row.
 */
export async function postPaymentAdjustmentGlEntry({
  tenantId,
  userId,
  paymentId,
  amount,
  paymentDate,
  paymentMethod,
  notes,
  tx = null,
}) {
  const numericAmount = parseMoney(amount);
  if (!tenantId || !userId || !paymentId || !numericAmount || numericAmount <= 0) {
    return null;
  }

  const db = tx || prisma;
  const cashGl = await getPaymentAccount(tenantId, paymentMethod, db);
  const capitalGl = await resolvePrimaryCapitalAccount(tenantId, db);
  if (!cashGl || !capitalGl) return null;

  const entryDate = paymentDate instanceof Date ? paymentDate : new Date(paymentDate || Date.now());
  await assertPeriodOpen(tenantId, entryDate, db);
  const reference = await generateReferenceNumber(db, tenantId, entryDate);

  const lines = [
    {
      lineNumber: 1,
      accountId: cashGl.id,
      debitAmount: numericAmount,
      creditAmount: 0,
      description: 'Cash adjustment',
    },
    {
      lineNumber: 2,
      accountId: capitalGl.id,
      debitAmount: 0,
      creditAmount: numericAmount,
      description: 'Offsetting equity',
    },
  ];
  const desc = notes?.trim() || 'Payment balance adjustment';
  const { postCapitalContributionAccounting } = await import(
    './accountingV2/adapters/remainingAdapters.js'
  );
  const outcome = await postCapitalContributionAccounting({
    db,
    tenantId,
    userId,
    sourceType: 'PaymentAdjustment',
    sourceId: paymentId,
    amount: numericAmount,
    date: entryDate,
    description: desc,
    lines,
    legacyPost: () =>
      postGlEntry({
        tenantId,
        userId,
        entryDate,
        description: desc,
        reference,
        sourceType: 'PaymentAdjustment',
        sourceId: paymentId,
        lines,
        tx,
      }),
  });
  return outcome.result;
}
