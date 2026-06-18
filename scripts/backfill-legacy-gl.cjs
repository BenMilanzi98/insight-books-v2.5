#!/usr/bin/env node
/**
 * Legacy GL backfill utilities (Phase 5). Default: --dry-run
 *
 * Usage:
 *   node scripts/backfill-legacy-gl.cjs capital --tenant-id=UUID [--apply]
 *   node scripts/backfill-legacy-gl.cjs mirrored-journals --tenant-id=UUID [--apply]
 *   node scripts/backfill-legacy-gl.cjs recalc-balances --tenant-id=UUID [--apply]
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const dryRun = !process.argv.includes('--apply');

function getArg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : null;
}

async function backfillCapitalLines(tenantId) {
  const orphans = await prisma.transaction.findMany({
    where: {
      tenantId,
      sourceType: 'capital_contribution',
      status: 'posted',
      lines: { none: {} },
    },
    include: {
      journalEntries: {
        where: { credit: { gt: 0 } },
      },
    },
  });

  console.log(`Capital transactions missing lines: ${orphans.length}`);
  if (dryRun || orphans.length === 0) return;

  for (const tx of orphans) {
    const debits = await prisma.journalEntry.findMany({
      where: { transactionId: tx.id, debit: { gt: 0 } },
    });
    const credits = await prisma.journalEntry.findMany({
      where: { transactionId: tx.id, credit: { gt: 0 } },
    });
    const lines = [];
    let n = 1;
    for (const d of debits) {
      lines.push({
        lineNumber: n++,
        accountId: d.accountId,
        debitAmount: d.debit,
        creditAmount: 0,
        description: d.description || tx.description,
        transactionId: tx.id,
      });
    }
    for (const c of credits) {
      lines.push({
        lineNumber: n++,
        accountId: c.accountId,
        debitAmount: 0,
        creditAmount: c.credit,
        description: c.description || tx.description,
        transactionId: tx.id,
      });
    }
    if (lines.length >= 2) {
      await prisma.transactionLine.createMany({ data: lines });
      console.log(`  Backfilled lines for transaction ${tx.id}`);
    }
  }
}

async function cleanupMirroredJournals(tenantId) {
  const mirrored = await prisma.journalEntry.findMany({
    where: {
      tenantId,
      transactionId: { not: null },
      status: 'Posted',
    },
    select: { id: true, transactionId: true },
  });
  console.log(`Mirrored journal entries (linked to Transaction): ${mirrored.length}`);
  if (dryRun || mirrored.length === 0) return;

  for (const je of mirrored) {
    await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: je.id } });
    await prisma.journalEntry.delete({ where: { id: je.id } });
    console.log(`  Removed mirrored journal ${je.id} (txn ${je.transactionId})`);
  }
}

async function recalcBalances(tenantId) {
  const accounts = await prisma.account.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, accountCode: true },
  });
  console.log(`Recalculating ${accounts.length} account balances...`);
  if (dryRun) return;

  const { recalculateAccountBalanceFromPostedGl } = await import('../lib/accountBalanceService.js');
  for (const acc of accounts) {
    await recalculateAccountBalanceFromPostedGl(acc.id, tenantId, prisma);
  }
  console.log('Done.');
}

async function main() {
  const cmd = process.argv[2];
  const tenantId = getArg('tenant-id');
  if (!tenantId) {
    console.error('Provide --tenant-id=');
    process.exit(1);
  }
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY'} | Tenant: ${tenantId}`);

  if (cmd === 'capital') await backfillCapitalLines(tenantId);
  else if (cmd === 'mirrored-journals') await cleanupMirroredJournals(tenantId);
  else if (cmd === 'recalc-balances') await recalcBalances(tenantId);
  else {
    console.log('Commands: capital | mirrored-journals | recalc-balances');
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
