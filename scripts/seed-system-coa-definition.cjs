#!/usr/bin/env node
/**
 * Upsert the platform default Chart of Accounts (SystemCoaDefinition) from the code blueprint
 * and optionally apply it to all existing tenants.
 *
 * Usage:
 *   node scripts/seed-system-coa-definition.cjs [--apply-tenants]
 */

require('dotenv').config();
const path = require('path');
const { pathToFileURL } = require('url');
const { PrismaClient } = require('@prisma/client');

const applyTenants = process.argv.includes('--apply-tenants');

async function loadLib(modulePath) {
  return import(pathToFileURL(path.join(__dirname, '..', modulePath)).href);
}

async function main() {
  const { buildDefaultSystemCoaPayload, validateSystemCoaPayload } = await loadLib(
    'lib/systemCoaPayload.js'
  );
  const payload = buildDefaultSystemCoaPayload();
  const validated = validateSystemCoaPayload(payload);
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  console.log(`Validated system CoA: ${validated.payload.accounts.length} accounts`);

  const prisma = new PrismaClient();
  try {
    const row = await prisma.systemCoaDefinition.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        payload: validated.payload,
        updatedByEmail: 'system@seed',
      },
      update: {
        payload: validated.payload,
        updatedByEmail: 'system@seed',
      },
    });
    console.log(`SystemCoaDefinition upserted (${row.id}) at ${row.updatedAt.toISOString()}`);

    if (applyTenants) {
      const { applySystemCoaPayloadToAllTenants } = await loadLib(
        'lib/applySystemCoaToAllTenants.js'
      );

      const result = await applySystemCoaPayloadToAllTenants(prisma, validated.payload);
      console.log(
        `Applied CoA to ${result.successCount}/${result.tenantCount} tenant(s)`
      );
      if (result.failures.length) {
        for (const f of result.failures) {
          console.warn(`  tenant ${f.tenantId}: ${f.message}`);
        }
      }

      const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
      const { ensureDuplicate5301MergedInto5200 } = await loadLib(
        'lib/incomeStatementExpenseAccountResolution.js'
      );
      for (const t of tenants) {
        await prisma.$transaction(async (tx) => {
          await ensureDuplicate5301MergedInto5200(tx, t.id);
        });
        const count = await prisma.account.count({ where: { tenantId: t.id } });
        const exp5000 = await prisma.account.count({
          where: { tenantId: t.id, accountType: 'Expense', accountCode: { gte: '5000', lte: '5999' } },
        });
        console.log(`  ${t.name}: ${count} account(s), ${exp5000} expense-range`);
      }
    } else {
      console.log('Pass --apply-tenants to provision accounts on existing tenants.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
