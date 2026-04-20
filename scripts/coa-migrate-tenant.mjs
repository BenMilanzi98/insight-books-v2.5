/**
 * CLI: dry-run (default) or execute CoA migration for one tenant.
 * Usage: node scripts/coa-migrate-tenant.mjs --tenantId=<id> [--execute]
 */
import 'dotenv/config';
import prisma from '../lib/prisma.js';
import { migrateCoaTenant } from '../lib/coaMigration/migrateTenant.js';

async function main() {
  const args = process.argv.slice(2);
  let tenantId = null;
  let execute = false;
  for (const a of args) {
    if (a === '--execute') execute = true;
    const m = /^--tenantId=(.+)$/.exec(a);
    if (m) tenantId = m[1];
  }
  if (!tenantId) {
    console.error('Usage: node scripts/coa-migrate-tenant.mjs --tenantId=<cuid> [--execute]');
    process.exit(1);
  }

  const result = await migrateCoaTenant({
    tenantId,
    dryRun: !execute,
    migrationBatchId: `cli-${Date.now()}`,
  });

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
