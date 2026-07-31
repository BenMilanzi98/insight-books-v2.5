/**
 * Phase 6 — Historical accounting repair CLI.
 *
 * Run with the alias loader (application modules use the Next.js `@/` alias):
 *
 *   node --import ./scripts/registerAliasLoader.mjs scripts/accounting-repair.mjs <command> ...
 *
 * Commands:
 *   audit     --business <tenantId> [--output file.json]
 *   list      --business <tenantId> [--status S] [--limit N]
 *   preview   --business <tenantId> --batch <id> --anomaly <id> --repair-type <T> [...]
 *   verify    --business <tenantId> --batch <id>
 *   reconcile --business <tenantId>
 *
 * Execution (`execute`) intentionally requires the API/UI approval workflow;
 * the CLI never executes financial repairs directly. Production protection:
 * every command refuses to run when NODE_ENV=production unless BOTH
 * --confirm-production and ACCOUNTING_REPAIR_ALLOW_PRODUCTION=1 are present.
 */

import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import { createAccountingContext } from '../lib/accountingV2/domain/accountingContext.js';
import { runAnomalyDetection } from '../lib/accountingV2/repair/anomalyDetectionService.js';
import { listAnomalies } from '../lib/accountingV2/repair/anomalyRegistryService.js';
import { dryRunRepair } from '../lib/accountingV2/repair/repairExecutionService.js';
import { verifyBatch } from '../lib/accountingV2/repair/repairVerificationService.js';
import { runLedgerReconciliation } from '../lib/accountingV2/ledger/ledgerReconciliationService.js';

function parseArgs(argv) {
  const [, , command, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith('--')) {
      const key = rest[i].slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return { command, flags };
}

function guardProduction(flags) {
  if (process.env.NODE_ENV === 'production') {
    if (flags['confirm-production'] !== true && flags['confirm-production'] !== 'true') {
      console.error('Refusing to run in production without --confirm-production.');
      process.exit(2);
    }
    if (process.env.ACCOUNTING_REPAIR_ALLOW_PRODUCTION !== '1') {
      console.error('Refusing to run in production without ACCOUNTING_REPAIR_ALLOW_PRODUCTION=1.');
      process.exit(2);
    }
  }
}

function output(flags, data) {
  const json = JSON.stringify(data, (k, v) => (typeof v === 'bigint' ? Number(v) : v), 2);
  if (flags.output) {
    fs.writeFileSync(flags.output, json);
    console.log(`Written: ${flags.output}`);
  } else {
    console.log(json);
  }
}

async function main() {
  const { command, flags } = parseArgs(process.argv);
  guardProduction(flags);
  if (!command || !flags.business) {
    console.error(
      'Usage: node scripts/accounting-repair.mjs <audit|list|preview|verify|reconcile> --business <tenantId> [flags]'
    );
    process.exit(1);
  }
  const prisma = new PrismaClient();
  // Audit rows FK to a real user: use --user, or resolve an active user of the
  // business so every CLI operation is attributable.
  let operatorId = flags.user;
  if (!operatorId) {
    const operator = await prisma.user.findFirst({
      where: { tenantId: flags.business, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true },
    });
    if (!operator) {
      console.error('No active user found for this business; pass --user <userId>.');
      process.exit(1);
    }
    operatorId = operator.id;
    console.error(`Operating as user ${operator.email} (${operator.id})`);
  }
  const context = createAccountingContext({
    businessId: flags.business,
    userId: operatorId,
    correlationId: `cli-${Date.now()}`,
  });
  try {
    switch (command) {
      case 'audit': {
        const result = await runAnomalyDetection(prisma, context, {});
        output(flags, result);
        break;
      }
      case 'list': {
        const result = await listAnomalies(prisma, context, {
          status: flags.status,
          severity: flags.severity,
          anomalyType: flags['anomaly-type'],
          pageSize: Number(flags.limit ?? 50),
        });
        output(flags, result);
        break;
      }
      case 'preview': {
        const proposedJournal = flags['proposal-file']
          ? JSON.parse(fs.readFileSync(flags['proposal-file'], 'utf8'))
          : undefined;
        const result = await dryRunRepair(prisma, context, {
          repairBatchId: flags.batch,
          anomalyId: flags.anomaly,
          repairType: flags['repair-type'],
          reason: flags.reason ?? 'CLI dry-run preview',
          proposedJournal,
          metadataChanges: flags['metadata-file']
            ? JSON.parse(fs.readFileSync(flags['metadata-file'], 'utf8'))
            : undefined,
        });
        output(flags, result);
        break;
      }
      case 'verify': {
        const result = await verifyBatch(prisma, context, flags.batch, {});
        output(flags, result);
        break;
      }
      case 'reconcile': {
        const result = await runLedgerReconciliation(prisma, context, {
          compareStoredBalances: true,
          compareProjection: true,
          runJournalChecks: true,
        });
        output(flags, result);
        break;
      }
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
