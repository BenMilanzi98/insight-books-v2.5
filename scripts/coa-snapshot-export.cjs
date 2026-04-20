#!/usr/bin/env node
/**
 * Phase 0: export tenant CoA (and key audit fields) to JSON for pre-migration backup.
 * Usage: node scripts/coa-snapshot-export.cjs [tenantId] [outputFile.json]
 * Omit tenantId to export every account row (all tenants); default output coa-snapshot-<tenantId>.json or coa-snapshot-all.json
 */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  const tenantId = process.argv[2] && !process.argv[2].endsWith('.json') ? process.argv[2] : null;
  const outArg = process.argv[3] || (process.argv[2]?.endsWith('.json') ? process.argv[2] : null);
  try {
    const where = tenantId ? { tenantId } : {};
    const accounts = await prisma.account.findMany({
      where,
      orderBy: [{ tenantId: 'asc' }, { accountCode: 'asc' }],
    });
    const payload = {
      exportedAt: new Date().toISOString(),
      tenantId,
      accountCount: accounts.length,
      accounts: accounts.map((a) => ({
        id: a.id,
        tenantId: a.tenantId,
        accountCode: a.accountCode,
        accountName: a.accountName,
        accountType: a.accountType,
        normalBalance: a.normalBalance,
        parentAccountId: a.parentAccountId,
        isActive: a.isActive,
        isSystem: a.isSystem,
        balance: a.balance,
        mergedIntoAccountId: a.mergedIntoAccountId,
        migratedToAccountCode: a.migratedToAccountCode,
        retiredAt: a.retiredAt,
        visibleInChart: a.visibleInChart,
        acceptsNewTransactions: a.acceptsNewTransactions,
      })),
    };
    const defaultName = tenantId ? `coa-snapshot-${tenantId}.json` : 'coa-snapshot-all.json';
    const outFile = path.resolve(process.cwd(), outArg || defaultName);
    fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`Wrote ${outFile} (${payload.accountCount} accounts).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
