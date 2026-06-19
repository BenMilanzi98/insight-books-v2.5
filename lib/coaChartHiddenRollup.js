/**
 * Accounts that contribute GL to chart rollups but must never appear as CoA rows.
 * (Legacy capital pool folded into 3100 Owner's Capital.)
 */

/** @type {Set<string>} */
export const CHART_ROLLUP_ONLY_ACCOUNT_CODES = new Set(['500000']);

/** @param {Record<string, unknown>|null|undefined} row */
export function isChartRollupOnlyAccount(row) {
  const code = String(row?.accountCode || row?.code || '').trim();
  return CHART_ROLLUP_ONLY_ACCOUNT_CODES.has(code);
}

/** Remove rollup-only rows from chart API / table payloads (balances already on parents). */
export function filterAccountsFromChartDisplay(accounts) {
  if (!Array.isArray(accounts)) return [];
  return accounts.filter((a) => !isChartRollupOnlyAccount(a));
}

/**
 * Load chart-hidden accounts still needed for parent rollup (e.g. 500000 under 3100).
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient} db
 */
export async function fetchChartRollupOnlyAccounts(tenantId, db) {
  const codes = [...CHART_ROLLUP_ONLY_ACCOUNT_CODES];
  if (!codes.length) return [];
  return db.account.findMany({
    where: {
      tenantId,
      mergedIntoAccountId: null,
      isActive: true,
      accountCode: { in: codes },
    },
    include: {
      parentAccount: {
        select: { id: true, accountCode: true, accountName: true },
      },
      mergedIntoAccount: {
        select: { id: true, accountCode: true, accountName: true },
      },
      childAccounts: {
        select: {
          id: true,
          accountCode: true,
          accountName: true,
          isActive: true,
          isSystem: true,
        },
      },
      _count: {
        select: {
          journalEntryLines: true,
          transactionLines: true,
        },
      },
    },
  });
}

/**
 * @param {Array<Record<string, unknown>>} visible
 * @param {Array<Record<string, unknown>>} rollupOnly
 */
export function mergeRollupOnlyAccountsForProcessing(visible, rollupOnly) {
  const ids = new Set((visible || []).map((a) => a.id));
  const extra = (rollupOnly || []).filter((a) => a?.id && !ids.has(a.id));
  return [...(visible || []), ...extra];
}
