#!/usr/bin/env node
/**
 * Fresh-books V2 reset — wipe live journals + V2 event data so every tenant
 * starts at zero. Leaves Transaction / TransactionLine untouched (archive).
 *
 * Usage:
 *   node scripts/fresh-books-v2-reset.js --confirm
 *
 * Refuses to run without --confirm.
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function countOrZero(fn) {
  try {
    return await fn();
  } catch {
    return 0;
  }
}

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.error('Refusing to wipe. Re-run with --confirm.');
    process.exitCode = 1;
    return;
  }

  console.log('Fresh-books V2 reset starting…');

  const before = {
    journalEntries: await countOrZero(() => prisma.journalEntry.count()),
    journalLines: await countOrZero(() => prisma.journalEntryLine.count()),
    events: await countOrZero(() => prisma.acctV2EventRegistry.count()),
    transactions: await countOrZero(() => prisma.transaction.count()),
  };
  console.log('Before:', before);

  await prisma.$transaction(async (tx) => {
    // Shadow stack
    await tx.acctV2ShadowComparison.deleteMany({});
    await tx.acctV2ShadowJournalLine.deleteMany({});
    await tx.acctV2ShadowJournal.deleteMany({});

    // Posting attempts → event registry → outbox
    await tx.acctV2PostingAttempt.deleteMany({});
    await tx.acctV2EventRegistry.deleteMany({});
    await tx.acctV2Outbox.deleteMany({});

    // Repair trail
    await tx.acctV2RepairException.deleteMany({});
    await tx.acctV2RepairSnapshot.deleteMany({});
    await tx.acctV2RepairAction.deleteMany({});
    await tx.acctV2RepairEvidence.deleteMany({});
    await tx.acctV2RepairBatch.deleteMany({});
    await tx.acctV2HistoricalAnomaly.deleteMany({});

    // Report artifacts
    await tx.acctV2ReportCache.deleteMany({});
    await tx.acctV2ReportSnapshotV2.deleteMany({});
    await tx.acctV2ReportRun.deleteMany({});

    // Opening balances + ledger projections + sequences
    await tx.acctV2OpeningBalanceBatch.deleteMany({});
    await tx.acctV2LedgerBalance.deleteMany({});
    await tx.acctV2JournalSequence.deleteMany({});

    // Journals — disable immutability triggers for this one-time cutover wipe only.
    await tx.$executeRawUnsafe(
      'ALTER TABLE "JournalEntryLine" DISABLE TRIGGER USER'
    );
    await tx.$executeRawUnsafe('ALTER TABLE "JournalEntry" DISABLE TRIGGER USER');
    await tx.journalEntryLine.deleteMany({});
    await tx.journalEntry.deleteMany({});
    await tx.$executeRawUnsafe('ALTER TABLE "JournalEntry" ENABLE TRIGGER USER');
    await tx.$executeRawUnsafe(
      'ALTER TABLE "JournalEntryLine" ENABLE TRIGGER USER'
    );

    // Cached balances (not CoA itself)
    await tx.accountBalanceHistory.deleteMany({});
    await tx.accountBalance.deleteMany({});
    await tx.account.updateMany({ data: { balance: 0 } });

    // Re-assert NEW_ENGINE config for every existing row
    await tx.acctV2Configuration.updateMany({
      data: {
        defaultPostingMode: 'NEW_ENGINE',
        accountingArchitectureVersion: 'ACCOUNTING_V2',
        enableShadowAccounting: false,
      },
    });
  });

  const cutoverFlags = [
    {
      flagKey: 'accountingV2Enabled',
      reason: 'Fresh-books V2-only cutover',
    },
    {
      flagKey: 'coaV2CanonicalMappings',
      reason: 'Fresh-books CoA SoT — canonical purpose mappings ON for all tenants',
    },
  ];

  for (const flag of cutoverFlags) {
    await prisma.acctV2FeatureFlag.upsert({
      where: {
        tenantId_flagKey_moduleKey_eventType: {
          tenantId: '*',
          flagKey: flag.flagKey,
          moduleKey: '*',
          eventType: '*',
        },
      },
      create: {
        tenantId: '*',
        flagKey: flag.flagKey,
        moduleKey: '*',
        eventType: '*',
        enabled: true,
        reason: flag.reason,
      },
      update: {
        enabled: true,
        reason: flag.reason,
      },
    });
  }

  const after = {
    journalEntries: await countOrZero(() => prisma.journalEntry.count()),
    journalLines: await countOrZero(() => prisma.journalEntryLine.count()),
    events: await countOrZero(() => prisma.acctV2EventRegistry.count()),
    transactions: await countOrZero(() => prisma.transaction.count()),
    accountsZeroed: await countOrZero(() =>
      prisma.account.count({ where: { balance: 0 } })
    ),
  };
  console.log('After:', after);
  console.log('Transaction archive preserved (not wiped).');
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
