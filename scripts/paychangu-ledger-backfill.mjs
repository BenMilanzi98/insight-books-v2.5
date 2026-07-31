/**
 * Ops CLI: dry-run / execute historical PayChangu → PlatformInvoice/Payment backfill.
 *
 * Usage:
 *   node scripts/paychangu-ledger-backfill.mjs
 *   node scripts/paychangu-ledger-backfill.mjs --execute --max=50 --limit=500
 */

import { PrismaClient } from '@prisma/client';
import { runPaychanguLedgerBackfill } from '../lib/admin/paychanguLedgerBackfill.js';

const args = process.argv.slice(2);
const execute = args.includes('--execute');
const maxArg = args.find((a) => a.startsWith('--max='));
const limitArg = args.find((a) => a.startsWith('--limit='));
const maxExecute = maxArg ? parseInt(maxArg.split('=')[1], 10) : 50;
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 500;

const prisma = new PrismaClient();

try {
  const result = await runPaychanguLedgerBackfill(prisma, {
    dryRun: !execute,
    limit,
    maxExecute,
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok && execute) process.exitCode = 1;
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
