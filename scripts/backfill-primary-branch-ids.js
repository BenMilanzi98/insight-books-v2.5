/**
 * One-time backfill: assign branchId: null records to each tenant's hidden primary branch.
 *
 * Usage:
 *   node scripts/backfill-primary-branch-ids.js              # all tenants
 *   node scripts/backfill-primary-branch-ids.js --dry-run    # preview only
 *   node scripts/backfill-primary-branch-ids.js --tenant=<id> # single tenant
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const tenantArg = args.find((a) => a.startsWith('--tenant='));
  const tenantId = tenantArg ? tenantArg.split('=')[1]?.trim() : undefined;

  const { backfillAllTenantsPrimaryBranch } = await import('../lib/backfillPrimaryBranch.js');

  console.log(`\nBackfill primary branch IDs${dryRun ? ' (DRY RUN)' : ''}`);
  if (tenantId) console.log(`Tenant filter: ${tenantId}`);
  console.log('');

  const summary = await backfillAllTenantsPrimaryBranch({ tenantId, dryRun });

  for (const row of summary.results) {
    const label = row.tenantName || row.tenantId;
    if (row.skipped) {
      console.log(`⏭  ${label}: skipped (${row.reason || 'unknown'})`);
      continue;
    }
    const total = row.totalUpdated ?? 0;
    if (total === 0) {
      console.log(`✓  ${label}: nothing to backfill`);
      continue;
    }
    console.log(`${dryRun ? '📋' : '✅'} ${label}: ${total} record(s)${dryRun ? ' would be' : ''} updated → branch ${row.primaryBranchId}`);
    if (dryRun || process.env.VERBOSE === '1') {
      for (const [key, count] of Object.entries(row.updated || row.counts || {})) {
        if (count > 0) console.log(`     ${key}: ${count}`);
      }
    }
  }

  console.log(`\nDone. Tenants: ${summary.tenantsProcessed}, total${dryRun ? ' (preview)' : ''}: ${summary.totalRecordsWouldUpdate}\n`);
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
