#!/usr/bin/env node
/**
 * Remove retired 1130-01 / 1130-02 bank accounts and migrate links to 1131 / 1132.
 * Usage: node scripts/migrate-remove-1130-dash-banks.cjs [--execute]
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const dryRun = !process.argv.includes('--execute');

const RETIRED = [
  { from: '1130-01', to: '1131' },
  { from: '1130-02', to: '1132' },
];

async function migrateTenant(tenantId) {
  const ops = [];

  for (const { from, to } of RETIRED) {
    const [oldAcc, newAcc] = await Promise.all([
      prisma.account.findFirst({ where: { tenantId, accountCode: from } }),
      prisma.account.findFirst({ where: { tenantId, accountCode: to } }),
    ]);
    if (!oldAcc) continue;
    if (!newAcc) {
      ops.push(`skip ${from}: target ${to} missing`);
      continue;
    }

    const blocking = await prisma.transactionLine.count({ where: { accountId: oldAcc.id } });
    const jeBlocking = await prisma.journalEntryLine.count({ where: { accountId: oldAcc.id } });
    if (blocking + jeBlocking > 0) {
      throw new Error(
        `Tenant ${tenantId}: cannot delete ${from} — ${blocking + jeBlocking} GL line(s) still posted`
      );
    }

    if (dryRun) {
      ops.push(`would migrate ${from} → ${to} and delete ${from}`);
      continue;
    }

    await prisma.paymentAccount.updateMany({
      where: { tenantId, coaAccountId: oldAcc.id },
      data: { coaAccountId: newAcc.id },
    });

    await prisma.invoiceItem.updateMany({
      where: { accountId: oldAcc.id },
      data: { accountId: newAcc.id },
    });
    await prisma.saleItem.updateMany({
      where: { accountId: oldAcc.id },
      data: { accountId: newAcc.id },
    });
    await prisma.product.updateMany({
      where: { incomeAccountId: oldAcc.id },
      data: { incomeAccountId: newAcc.id },
    });
    await prisma.product.updateMany({
      where: { cogsAccountId: oldAcc.id },
      data: { cogsAccountId: newAcc.id },
    });
    await prisma.product.updateMany({
      where: { inventoryAccountId: oldAcc.id },
      data: { inventoryAccountId: newAcc.id },
    });

    await prisma.account.updateMany({
      where: { tenantId, parentAccountId: oldAcc.id },
      data: { parentAccountId: newAcc.id },
    });

    await prisma.account.delete({ where: { id: oldAcc.id } });
    ops.push(`deleted ${from}, links → ${to}`);
  }

  if (!dryRun) {
    await prisma.account.updateMany({
      where: { tenantId, accountCode: '1140' },
      data: { accountName: 'Mobile Money - Airtel Money', name: 'Mobile Money - Airtel Money' },
    });
    const bankRenames = [
      ['1131', 'National Bank of Malawi'],
      ['1132', 'Standard Bank Malawi'],
      ['1133', 'FDH Bank'],
      ['1134', 'NBS Bank'],
      ['1135', 'First Capital Bank'],
      ['1136', 'Ecobank Malawi'],
      ['1137', 'Centenary Bank Malawi'],
      ['1138', 'CDH Investment Bank'],
    ];
    for (const [code, name] of bankRenames) {
      await prisma.account.updateMany({
        where: { tenantId, accountCode: code },
        data: { accountName: name, name },
      });
    }
  }

  return ops;
}

async function main() {
  console.log(dryRun ? '\n🔍 DRY RUN\n' : '\n⚠️ EXECUTING bank migration\n');
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  for (const t of tenants) {
    console.log(`\n${t.name} (${t.id})`);
    const ops = await migrateTenant(t.id);
    for (const line of ops) console.log(' ', line);
  }
  if (dryRun) console.log('\nRe-run with --execute');
}

main()
  .catch((e) => {
    console.error('❌', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
