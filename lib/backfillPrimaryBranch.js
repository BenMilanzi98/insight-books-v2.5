/**
 * Backfill legacy records with branchId: null to each tenant's hidden primary branch.
 */
import prisma from '@/lib/prisma';
import { ensurePrimaryBranchForTenant } from '@/lib/tenantStockAccess';

/** Prisma delegates with optional tenantId + branchId (nullable). */
export const BACKFILL_BRANCH_MODELS = [
  { key: 'sales', delegate: 'sale' },
  { key: 'invoices', delegate: 'invoice' },
  { key: 'expenses', delegate: 'expense' },
  { key: 'payments', delegate: 'payment' },
  { key: 'products', delegate: 'product' },
  { key: 'transactions', delegate: 'transaction' },
  { key: 'journalEntries', delegate: 'journalEntry' },
  { key: 'inventoryTransactions', delegate: 'inventoryTransaction' },
  { key: 'inventoryBatches', delegate: 'inventoryBatch' },
  { key: 'inventoryExpiryAudits', delegate: 'inventoryExpiryAudit' },
  { key: 'rentalAssets', delegate: 'rentalAsset' },
  { key: 'budgetItems', delegate: 'legacyBudgetItem' },
];

/**
 * Count null branchId rows per model for one tenant.
 * @param {string} tenantId
 * @param {import('@prisma/client').Prisma.TransactionClient | typeof prisma} [db]
 */
export async function countNullBranchIdsForTenant(tenantId, db = prisma) {
  const counts = {};
  for (const { key, delegate } of BACKFILL_BRANCH_MODELS) {
    const model = db[delegate];
    if (!model?.count) continue;
    counts[key] = await model.count({
      where: { tenantId, branchId: null },
    });
  }
  return counts;
}

/**
 * Assign null branchId rows to primary branch for one tenant.
 * @param {string} tenantId
 * @param {{ dryRun?: boolean, db?: import('@prisma/client').Prisma.TransactionClient | typeof prisma }} [options]
 */
export async function backfillPrimaryBranchForTenant(tenantId, options = {}) {
  const { dryRun = false, db = prisma } = options;
  const primaryBranchId = await ensurePrimaryBranchForTenant(tenantId, db);
  if (!primaryBranchId) {
    return {
      tenantId,
      primaryBranchId: null,
      skipped: true,
      reason: 'Could not resolve primary branch',
      counts: {},
      updated: {},
    };
  }

  const counts = await countNullBranchIdsForTenant(tenantId, db);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  if (total === 0) {
    return {
      tenantId,
      primaryBranchId,
      skipped: false,
      counts,
      updated: {},
      totalUpdated: 0,
    };
  }

  if (dryRun) {
    return {
      tenantId,
      primaryBranchId,
      dryRun: true,
      counts,
      updated: Object.fromEntries(Object.keys(counts).map((k) => [k, counts[k]])),
      totalUpdated: total,
    };
  }

  const updated = await db.$transaction(async (tx) => {
    const results = {};
    for (const { key, delegate } of BACKFILL_BRANCH_MODELS) {
      if (!counts[key]) continue;
      const model = tx[delegate];
      if (!model?.updateMany) continue;
      const res = await model.updateMany({
        where: { tenantId, branchId: null },
        data: { branchId: primaryBranchId },
      });
      results[key] = res.count;
    }

    await tx.user.updateMany({
      where: {
        tenantId,
        OR: [{ defaultBranchId: null }, { defaultBranchId: { not: primaryBranchId } }],
      },
      data: { defaultBranchId: primaryBranchId },
    });

    await tx.tenant.update({
      where: { id: tenantId },
      data: { defaultBranchId: primaryBranchId },
    });

    return results;
  });

  const totalUpdated = Object.values(updated).reduce((sum, n) => sum + n, 0);
  return { tenantId, primaryBranchId, counts, updated, totalUpdated };
}

/**
 * Backfill all tenants (or one tenant when tenantId provided).
 * @param {{ tenantId?: string, dryRun?: boolean }} [options]
 */
export async function backfillAllTenantsPrimaryBranch(options = {}) {
  const { tenantId, dryRun = false } = options;
  const tenants = tenantId
    ? await prisma.tenant.findMany({ where: { id: tenantId }, select: { id: true, name: true } })
    : await prisma.tenant.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });

  const results = [];
  for (const tenant of tenants) {
    const result = await backfillPrimaryBranchForTenant(tenant.id, { dryRun });
    results.push({ tenantName: tenant.name, ...result });
  }

  const summary = {
    tenantsProcessed: results.length,
    dryRun,
    totalRecordsWouldUpdate: results.reduce((s, r) => s + (r.totalUpdated ?? 0), 0),
    results,
  };
  return summary;
}
