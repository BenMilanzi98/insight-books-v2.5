/**
 * Idempotent backfill of baseline financial setup for every tenant
 * (CoA, payment accounts, tax defaults, open period).
 * Also retires banned GL codes (1120 Petty Cash → 1110).
 */

import prisma from '@/lib/prisma.js';
import { initializeNewTenantFinancialDefaults } from '@/lib/initializeNewTenantFinancialDefaults.js';
import { retireBannedGlAccountsForTenant } from '@/lib/retireBannedGlAccounts.js';

/**
 * @param {import('@prisma/client').PrismaClient} [db]
 * @param {{ preferSystemCoaDefinition?: boolean, tenantIds?: string[] }} [options]
 */
export async function syncFinancialDefaultsForAllTenants(db = prisma, options = {}) {
  const preferSystemCoaDefinition = options.preferSystemCoaDefinition !== false;
  const where = Array.isArray(options.tenantIds) && options.tenantIds.length
    ? { id: { in: options.tenantIds } }
    : {};

  const tenants = await db.tenant.findMany({
    where,
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  const failures = [];
  let successCount = 0;

  for (const tenant of tenants) {
    try {
      await initializeNewTenantFinancialDefaults(tenant.id, db, { preferSystemCoaDefinition });
      await retireBannedGlAccountsForTenant(tenant.id, db);
      const accountCount = await db.account.count({
        where: { tenantId: tenant.id, isActive: true, mergedIntoAccountId: null },
      });
      successCount += 1;
      console.info(
        `[sync-financial-defaults] ok tenant=${tenant.id} name=${tenant.name} accounts=${accountCount}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ tenantId: tenant.id, name: tenant.name, error: message });
      console.error(`[sync-financial-defaults] fail tenant=${tenant.id}:`, message);
    }
  }

  return {
    tenantCount: tenants.length,
    successCount,
    failureCount: failures.length,
    failures,
  };
}
