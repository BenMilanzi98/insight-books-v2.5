/**
 * Phase 6 forensic trace: owner capital and liability accounts.
 * For every business: each Equity/Liability account's STORED balance vs the
 * CANONICAL journal-derived balance (Phase 5 authority rules), plus opening
 * evidence. Read-only. Output: artifacts/accounting-repair/capital-liability-trace.json
 */

import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import { createAccountingContext } from '../lib/accountingV2/domain/accountingContext.js';
import { getCanonicalAccountTotals } from '../lib/accountingV2/ledger/canonicalJournalSource.js';

const prisma = new PrismaClient();
const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
const report = [];

for (const tenant of tenants) {
  const user = await prisma.user.findFirst({ where: { tenantId: tenant.id }, select: { id: true } });
  if (!user) continue;
  const context = createAccountingContext({ businessId: tenant.id, userId: user.id });
  const totals = await getCanonicalAccountTotals(prisma, context, {});
  const accounts = await prisma.account.findMany({
    where: {
      tenantId: tenant.id,
      OR: [
        { accountType: { in: ['Equity', 'Liability'] } },
        { type: { in: ['Equity', 'Liability', 'equity', 'liability'] } },
      ],
    },
    select: {
      id: true, accountCode: true, accountName: true, accountType: true,
      balance: true, normalBalance: true, parentAccountId: true, isActive: true,
    },
  });
  const rows = [];
  for (const account of accounts) {
    const t = totals.get(account.id) ?? { debitMinor: 0, creditMinor: 0, lineCount: 0 };
    // Equity/liability are credit-normal: canonical balance = credits − debits.
    const canonicalMinor = t.creditMinor - t.debitMinor;
    const storedMinor = Math.round(Number(account.balance ?? 0) * 100);
    if (storedMinor === 0 && canonicalMinor === 0 && t.lineCount === 0) continue;
    rows.push({
      accountId: account.id,
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      storedMinor,
      canonicalMinor,
      canonicalLineCount: t.lineCount,
      differenceMinor: storedMinor - canonicalMinor,
      classification:
        storedMinor === canonicalMinor
          ? 'EXACT_MATCH'
          : canonicalMinor === 0 && storedMinor !== 0
            ? 'UNSUPPORTED_STORED_BALANCE'
            : storedMinor === 0 && canonicalMinor !== 0
              ? 'STALE_ZERO_CACHE'
              : storedMinor === 2 * canonicalMinor
                ? 'DOUBLE_COUNT_SUSPECT'
                : 'STORED_BALANCE_DRIFT',
    });
  }
  if (rows.length > 0) report.push({ tenantId: tenant.id, tenantName: tenant.name, accounts: rows });
}

fs.mkdirSync('artifacts/accounting-repair', { recursive: true });
fs.writeFileSync(
  'artifacts/accounting-repair/capital-liability-trace.json',
  JSON.stringify(report, null, 2)
);
console.log(JSON.stringify(report, null, 2));
await prisma.$disconnect();
