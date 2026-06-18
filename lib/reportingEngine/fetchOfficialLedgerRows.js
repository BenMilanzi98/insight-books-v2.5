/**
 * Fetch posted GL survivor totals for a period with account metadata.
 */
import prisma from '@/lib/prisma.js';
import { buildOfficialLedgerTotals } from '@/lib/officialLedgerEngine.js';
import {
  computePeriodNetMovement,
  isGroupHeaderAccount,
  normalizeAccountType,
} from './accountClassification.js';

/**
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string|Date} params.startDate
 * @param {string|Date} params.endDate
 * @param {string|null} [params.branchId]
 * @param {import('@prisma/client').PrismaClient} [params.prisma]
 */
export async function fetchOfficialLedgerRows({
  tenantId,
  startDate,
  endDate,
  branchId = null,
  prisma: db = prisma,
}) {
  const { totalsByAccountId, sourcePolicy } = await buildOfficialLedgerTotals({
    tenantId,
    branchId,
    startDate,
    endDate,
    prisma: db,
  });

  const accountIds = Array.from(totalsByAccountId.keys());
  const accounts = accountIds.length
    ? await db.account.findMany({
        where: { tenantId, id: { in: accountIds } },
        select: {
          id: true,
          accountCode: true,
          accountName: true,
          name: true,
          accountType: true,
          type: true,
          accountSubtype: true,
          normalBalance: true,
          parentAccountId: true,
          acceptsNewTransactions: true,
          isActive: true,
          mergedIntoAccountId: true,
        },
      })
    : [];

  const parentIdsWithChildren = new Set(
    (
      await db.account.findMany({
        where: { tenantId, parentAccountId: { not: null }, isActive: true },
        select: { parentAccountId: true },
      })
    )
      .map((r) => r.parentAccountId)
      .filter(Boolean)
  );

  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  const rows = [];
  for (const [accountId, totals] of totalsByAccountId.entries()) {
    const account = accountMap.get(accountId);
    if (!account || account.mergedIntoAccountId) continue;
    if (isGroupHeaderAccount(account, parentIdsWithChildren)) continue;

    const debitTotal = Number(totals.debitAmount) || 0;
    const creditTotal = Number(totals.creditAmount) || 0;
    const netMovement = computePeriodNetMovement(account, debitTotal, creditTotal);

    rows.push({
      accountId,
      accountCode: account.accountCode || '',
      accountName: account.accountName || account.name || 'Unknown',
      accountType: normalizeAccountType(account),
      accountSubtype: account.accountSubtype || null,
      normalBalance: account.normalBalance || null,
      debitTotal,
      creditTotal,
      netMovement,
      account,
    });
  }

  rows.sort((a, b) => {
    const na = parseInt(a.accountCode, 10);
    const nb = parseInt(b.accountCode, 10);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return String(a.accountCode).localeCompare(String(b.accountCode));
  });

  return { rows, sourcePolicy, parentIdsWithChildren };
}

/**
 * Cumulative GL rows through as-of date (balance sheet / control accounts).
 */
export async function fetchOfficialLedgerAsOfRows({
  tenantId,
  asOfDate,
  branchId = null,
  prisma: db = prisma,
}) {
  const startDate = '1970-01-01';
  return fetchOfficialLedgerRows({
    tenantId,
    startDate,
    endDate: asOfDate,
    branchId,
    prisma: db,
  });
}
