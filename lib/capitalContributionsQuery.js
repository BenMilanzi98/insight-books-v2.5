/**
 * Reads capital contributions from posted GL (TransactionLine) with legacy JournalEntry fallback.
 */

import prisma from './prisma.js';
import { POSTED_TRANSACTION_STATUSES } from './accountingEngine/constants.js';

function isCashDebitAccount(account) {
  if (!account) return false;
  const nameLower = String(account.name || account.accountName || '').toLowerCase();
  const type = String(account.type || account.accountType || '').toUpperCase();
  if (type !== 'ASSET' && type !== 'ASSETS') return false;
  return (
    nameLower.includes('cash') ||
    nameLower.includes('bank') ||
    nameLower.includes('checking') ||
    nameLower.includes('savings') ||
    nameLower.includes('mobile')
  );
}

function mapFromTransactionLines(transaction, creditAccountIds) {
  const lines = transaction.lines || [];
  const creditLine = lines.find(
    (l) => creditAccountIds.includes(l.accountId) && Number(l.creditAmount || 0) > 0
  );
  const debitLine = lines.find((l) => Number(l.debitAmount || 0) > 0);
  if (!creditLine) return null;

  const debitAccount = debitLine?.account;
  const type = isCashDebitAccount(debitAccount) ? 'cash' : 'asset';
  const cr = creditLine.account;
  const coaCode = cr?.accountCode || cr?.code || '';

  return {
    id: transaction.id,
    date: transaction.date,
    amount: Number(creditLine.creditAmount || 0),
    type,
    reference: transaction.reference,
    description: transaction.description,
    transactionId: transaction.id,
    debitAccountId: debitLine?.accountId || null,
    debitAccountName: debitAccount?.name || debitAccount?.accountName || 'Unknown',
    contributionAccountId: creditLine.accountId,
    contributionAccountCode: coaCode,
    source: 'transaction_line',
  };
}

function mapFromLegacyJournal(creditEntry, tx, debitEntry, debitAccount, creditAcctMap) {
  const debitAccountName = debitAccount?.name || debitAccount?.accountName || 'Unknown';
  const nameLower = debitAccountName.toLowerCase();
  const isCash =
    nameLower.includes('cash') ||
    nameLower.includes('bank') ||
    nameLower.includes('checking') ||
    nameLower.includes('savings');
  const type = isCash ? 'cash' : 'asset';
  const cr = creditAcctMap[creditEntry.accountId];
  const coaCode = cr?.accountCode || cr?.code || '';

  return {
    id: creditEntry.id,
    date: tx?.date || creditEntry.entryDate || creditEntry.createdAt,
    amount: Number(creditEntry.credit || 0),
    type,
    reference: tx?.reference || creditEntry.referenceNumber,
    description: tx?.description || creditEntry.description,
    transactionId: creditEntry.transactionId,
    debitAccountId: debitEntry?.accountId || null,
    debitAccountName,
    contributionAccountId: creditEntry.accountId,
    contributionAccountCode: coaCode,
    source: 'legacy_journal',
  };
}

/**
 * @param {string} tenantId
 * @param {string[]} creditAccountIds Equity child + 3100 ids
 * @param {import('@prisma/client').PrismaClient} [db]
 */
export async function fetchCapitalContributions(tenantId, creditAccountIds, db = prisma) {
  if (!creditAccountIds?.length) {
    return { contributions: [], totalCash: 0, totalAsset: 0 };
  }

  const [modernTx, legacyCredits] = await Promise.all([
    db.transaction.findMany({
      where: {
        tenantId,
        sourceType: 'capital_contribution',
        status: { in: POSTED_TRANSACTION_STATUSES },
        isReversal: false,
      },
      include: {
        lines: {
          include: {
            account: {
              select: {
                id: true,
                accountCode: true,
                code: true,
                accountName: true,
                name: true,
                accountType: true,
                type: true,
              },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
    }),
    db.journalEntry.findMany({
      where: {
        tenantId,
        accountId: { in: creditAccountIds },
        credit: { gt: 0 },
        transactionId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const modernMapped = modernTx
    .map((tx) => mapFromTransactionLines(tx, creditAccountIds))
    .filter(Boolean);

  const modernTxIds = new Set(modernMapped.map((c) => c.transactionId));

  const legacyOnly = legacyCredits.filter((e) => !modernTxIds.has(e.transactionId));
  const legacyTxIds = [...new Set(legacyOnly.map((e) => e.transactionId).filter(Boolean))];

  let legacyMapped = [];
  if (legacyOnly.length > 0) {
    const [transactions, debitEntries, creditAccounts] = await Promise.all([
      db.transaction.findMany({ where: { id: { in: legacyTxIds } } }),
      db.journalEntry.findMany({
        where: { transactionId: { in: legacyTxIds }, debit: { gt: 0 } },
      }),
      db.account.findMany({
        where: { id: { in: [...new Set(legacyOnly.map((e) => e.accountId))] } },
        select: { id: true, accountCode: true, code: true, accountName: true, name: true },
      }),
    ]);

    const txMap = Object.fromEntries(transactions.map((t) => [t.id, t]));
    const debitMap = {};
    for (const de of debitEntries) {
      if (!debitMap[de.transactionId]) debitMap[de.transactionId] = de;
    }
    const creditAcctMap = Object.fromEntries(creditAccounts.map((a) => [a.id, a]));

    const debitAccountIds = [...new Set(debitEntries.map((e) => e.accountId).filter(Boolean))];
    const debitAccounts = await db.account.findMany({ where: { id: { in: debitAccountIds } } });
    const acctMap = Object.fromEntries(debitAccounts.map((a) => [a.id, a]));

    legacyMapped = legacyOnly.map((entry) =>
      mapFromLegacyJournal(
        entry,
        txMap[entry.transactionId],
        debitMap[entry.transactionId],
        acctMap[debitMap[entry.transactionId]?.accountId],
        creditAcctMap
      )
    );
  }

  const contributions = [...modernMapped, ...legacyMapped].sort(
    (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
  );

  let totalCash = 0;
  let totalAsset = 0;
  for (const c of contributions) {
    if (c.type === 'cash') totalCash += c.amount;
    else totalAsset += c.amount;
  }

  return { contributions, totalCash, totalAsset };
}
