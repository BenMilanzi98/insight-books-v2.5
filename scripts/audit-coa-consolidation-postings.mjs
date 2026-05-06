#!/usr/bin/env node
/**
 * List CoA rows that are consolidation / non-posting targets but still have a non-zero stored balance.
 * After enforcing leaf-only postings, these should be drained via leaf-to-leaf reclass journals (not new activity on rollups).
 *
 * Usage:
 *   node scripts/audit-coa-consolidation-postings.mjs <tenantId>
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = (await import('../lib/prisma.js')).default;
const { accountBlocksDirectPosting, coaAccountDisplayLabel } = await import(
  '../lib/coaDirectPostingEligibility.js'
);

async function main() {
  const tenantId = process.argv[2];
  if (!tenantId || tenantId.startsWith('-')) {
    console.error('Usage: node scripts/audit-coa-consolidation-postings.mjs <tenantId>');
    process.exit(1);
  }

  const rows = await prisma.account.findMany({
    where: { tenantId },
    select: {
      id: true,
      accountCode: true,
      code: true,
      accountName: true,
      name: true,
      balance: true,
      isActive: true,
      acceptsNewTransactions: true,
      _count: {
        select: {
          childAccounts: { where: { isActive: true } },
        },
      },
    },
  });

  const dirty = [];
  for (const row of rows) {
    const block = accountBlocksDirectPosting(row);
    const bal = Math.abs(Number(row.balance) || 0);
    if (block.blocked && bal > 0.0001) {
      dirty.push({
        label: coaAccountDisplayLabel(row),
        balance: row.balance,
        reason: block.reason,
      });
    }
  }

  if (dirty.length === 0) {
    console.log('No consolidation / header accounts with non-zero balance for this tenant.');
    return;
  }

  console.log(
    `Found ${dirty.length} account(s) that block direct postings but have a non-zero balance — review and reclass to leaf accounts:\n`,
  );
  for (const d of dirty) {
    console.log(`  • ${d.label}  balance=${d.balance}  (${d.reason})`);
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
