/**
 * Read-only checks for Chart-of-Accounts / GL integrity (duplicate-looking balances, parent postings).
 * Use from admin tools, scripts, or support — not wired into hot request paths by default.
 */
import prisma from '@/lib/prisma';

const POSTED = { in: ['posted', 'Posted'] };

/**
 * Asset accounts with active children that still have posted Transaction lines on the parent row.
 *
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient} [db]
 * @returns {Promise<Array<{ accountId: string; accountCode: string; lineCount: number; childCount: number }>>}
 */
export async function findAssetParentsWithDirectTransactionLines(tenantId, db = prisma) {
  const parents = await db.account.findMany({
    where: {
      tenantId,
      isActive: true,
      accountType: 'Asset',
      mergedIntoAccountId: null,
      childAccounts: { some: { isActive: true } },
    },
    select: {
      id: true,
      accountCode: true,
      code: true,
      _count: { select: { childAccounts: { where: { isActive: true } } } },
    },
  });
  if (!parents.length) return [];

  const parentIds = parents.map((p) => p.id);
  const grouped = await db.transactionLine.groupBy({
    by: ['accountId'],
    where: {
      accountId: { in: parentIds },
      transaction: { tenantId, status: POSTED, isReversal: false },
    },
    _count: { id: true },
  });
  const countBy = new Map(grouped.map((g) => [g.accountId, g._count.id]));
  const out = [];
  for (const p of parents) {
    const n = countBy.get(p.id) || 0;
    if (n > 0) {
      out.push({
        accountId: p.id,
        accountCode: String(p.accountCode || p.code || '').trim(),
        lineCount: n,
        childCount: p._count.childAccounts,
      });
    }
  }
  return out;
}

/**
 * Same as {@link findAssetParentsWithDirectTransactionLines} for manual JournalEntry lines
 * (posted, not linked to a system Transaction mirror).
 *
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient} [db]
 */
export async function findAssetParentsWithDirectJournalLines(tenantId, db = prisma) {
  const parents = await db.account.findMany({
    where: {
      tenantId,
      isActive: true,
      accountType: 'Asset',
      mergedIntoAccountId: null,
      childAccounts: { some: { isActive: true } },
    },
    select: {
      id: true,
      accountCode: true,
      code: true,
      _count: { select: { childAccounts: { where: { isActive: true } } } },
    },
  });
  if (!parents.length) return [];

  const parentIds = parents.map((p) => p.id);
  const grouped = await db.journalEntryLine.groupBy({
    by: ['accountId'],
    where: {
      accountId: { in: parentIds },
      journalEntry: {
        tenantId,
        status: { in: ['Posted', 'posted'] },
        transactionId: null,
      },
    },
    _count: { id: true },
  });
  const countBy = new Map(grouped.map((g) => [g.accountId, g._count.id]));
  const out = [];
  for (const p of parents) {
    const n = countBy.get(p.id) || 0;
    if (n > 0) {
      out.push({
        accountId: p.id,
        accountCode: String(p.accountCode || p.code || '').trim(),
        lineCount: n,
        childCount: p._count.childAccounts,
      });
    }
  }
  return out;
}

/**
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient} [db]
 * @returns {Promise<{ txnParents: Awaited<ReturnType<typeof findAssetParentsWithDirectTransactionLines>>; jeParents: Awaited<ReturnType<typeof findAssetParentsWithDirectJournalLines>> }>}
 */
export async function auditCoaPostingParents(tenantId, db = prisma) {
  const [txnParents, jeParents] = await Promise.all([
    findAssetParentsWithDirectTransactionLines(tenantId, db),
    findAssetParentsWithDirectJournalLines(tenantId, db),
  ]);
  return { txnParents, jeParents };
}
