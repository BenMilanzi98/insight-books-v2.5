/**
 * Repair tenant CoA: gap-fill blueprint, sync fields, re-parent, retire unused code duplicates.
 *
 * Usage:
 *   node scripts/coa-repair-structure.mjs --tenantId=<id>           # dry run
 *   node scripts/coa-repair-structure.mjs --tenantId=<id> --execute
 *   node scripts/coa-repair-structure.mjs --all --execute           # all tenants
 */
import 'dotenv/config';
import prisma from '../lib/prisma.js';
import { repairTenantCoaStructure } from '../lib/coaStructureRepair.js';

async function main() {
  const args = process.argv.slice(2);
  let tenantId = null;
  let all = false;
  let execute = false;
  for (const a of args) {
    if (a === '--execute') execute = true;
    if (a === '--all') all = true;
    const m = /^--tenantId=(.+)$/.exec(a);
    if (m) tenantId = m[1];
  }

  const tenantIds = all
    ? (await prisma.tenant.findMany({ select: { id: true } })).map((t) => t.id)
    : tenantId
      ? [tenantId]
      : [];

  if (!tenantIds.length) {
    console.error('Usage: node scripts/coa-repair-structure.mjs --tenantId=<id> [--execute]');
    console.error('   or: node scripts/coa-repair-structure.mjs --all [--execute]');
    process.exit(1);
  }

  for (const tid of tenantIds) {
    console.log(`\n▶ ${execute ? 'Repairing' : 'Dry run for'} tenant ${tid}`);
    const result = await repairTenantCoaStructure(tid, { dryRun: !execute });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
