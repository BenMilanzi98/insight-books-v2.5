/**
 * Consolidate Salary Expense Accounts to Single Code 5200 - Salaries & Wages
 *
 * The system uses one standard account code (5200) for all salary expenses.
 * This account is used when processing payroll and is shown/traced in chart of accounts.
 * This script:
 * - For each tenant, picks or creates a single "Salaries & Wages" account with code 5200
 * - Migrates all TransactionLine and JournalEntryLine from legacy salary accounts (or other
 *   salary-named expense accounts) to the 5200 account
 * - Preserves all data; no amounts are lost
 * - Marks deprecated salary accounts as inactive (isActive = false)
 *
 * Run: node scripts/consolidate-salary-accounts.js
 * Dry run: node scripts/consolidate-salary-accounts.js --dry-run
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');

function isExpenseAccount(acc) {
  const t = (acc.accountType || acc.type || '').toLowerCase();
  return t === 'expense' || t === 'exp';
}

const SALARY_ACCOUNT_CODE = '5200';
const SALARY_ACCOUNT_NAME = 'Salaries & Wages';

function isSalaryLike(acc) {
  const name = ((acc.accountName || acc.name || '') + ' ' + (acc.accountCode || '')).toLowerCase();
  return (
    (acc.accountCode === '5201' ||
      acc.accountCode === '5202' ||
      acc.accountCode === '5203' ||
      acc.accountCode === '5210' ||
      acc.accountCode === '5230' ||
      (acc.accountCode === '5301' && /(salar|wages?)/i.test(name))) ||
    name.includes('salar') ||
    name.includes('wages') ||
    name.includes('payroll')
  );
}

async function getCanonicalSalaryAccount(tenantId) {
  // Prefer existing 5200 - Salaries & Wages (canonical payroll salary expense)
  let canonical = await prisma.account.findFirst({
    where: { tenantId, accountCode: SALARY_ACCOUNT_CODE, isActive: true }
  });
  if (canonical && isExpenseAccount(canonical)) return canonical;

  if (DRY_RUN) return null;

  const expensesRoot = await prisma.account.findFirst({
    where: { tenantId, accountCode: '5000' },
    select: { id: true }
  });

  return prisma.account.create({
    data: {
      code: SALARY_ACCOUNT_CODE,
      name: SALARY_ACCOUNT_NAME,
      type: 'EXPENSE',
      accountCode: SALARY_ACCOUNT_CODE,
      accountName: SALARY_ACCOUNT_NAME,
      accountType: 'Expense',
      accountSubtype: 'Operating Expense',
      normalBalance: 'Debit',
      balance: 0,
      tenantId,
      isActive: true,
      acceptsNewTransactions: true,
      visibleInChart: true,
      ...(expensesRoot ? { parentAccountId: expensesRoot.id } : {}),
    }
  });
}

async function getOtherSalaryAccounts(tenantId, canonicalId) {
  const accounts = await prisma.account.findMany({
    where: {
      tenantId,
      id: { not: canonicalId },
      OR: [
        { accountCode: '5300' },
        { accountCode: '5301' },
        { accountCode: '6000' },
        { name: { contains: 'Salary', mode: 'insensitive' } },
        { accountName: { contains: 'Salary', mode: 'insensitive' } },
        { name: { contains: 'Wages', mode: 'insensitive' } },
        { accountName: { contains: 'Wages', mode: 'insensitive' } }
      ]
    }
  });
  return accounts.filter((a) => isExpenseAccount(a) && !(a.accountName || a.name || '').toLowerCase().includes('cogs'));
}

async function main() {
  console.log('\n==========================================');
  console.log('Consolidate Salary Accounts -> 5200 - Salaries & Wages');
  console.log(DRY_RUN ? '(DRY RUN - no changes written)\n' : '\n');

  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true }
  });

  for (const tenant of tenants) {
    console.log(`\nTenant: ${tenant.name} (${tenant.id})`);

    const canonical = await getCanonicalSalaryAccount(tenant.id);
    if (!canonical) {
      console.log('  No salary expense account found; skipping.');
      continue;
    }
    console.log(`  Canonical account: ${canonical.accountCode} - ${canonical.accountName || canonical.name} (${canonical.id})`);

    const others = await getOtherSalaryAccounts(tenant.id, canonical.id);
    if (others.length === 0) {
      console.log('  No other salary accounts to consolidate.');
      continue;
    }

    for (const other of others) {
      console.log(`  Consolidating: ${other.accountCode} - ${other.accountName || other.name} (${other.id})`);

      const txCount = await prisma.transactionLine.count({ where: { accountId: other.id } });
      const jeCount = await prisma.journalEntryLine.count({ where: { accountId: other.id } });

      if (DRY_RUN) {
        console.log(`    [DRY RUN] Would move ${txCount} transaction lines and ${jeCount} journal entry lines.`);
        continue;
      }

      if (txCount > 0) {
        await prisma.transactionLine.updateMany({
          where: { accountId: other.id },
          data: { accountId: canonical.id }
        });
        console.log(`    Moved ${txCount} transaction lines.`);
      }
      if (jeCount > 0) {
        await prisma.journalEntryLine.updateMany({
          where: { accountId: other.id },
          data: { accountId: canonical.id }
        });
        console.log(`    Moved ${jeCount} journal entry lines.`);
      }

      await prisma.account.update({
        where: { id: other.id },
        data: { isActive: false }
      });
      console.log(`    Set account inactive.`);
    }
  }

  console.log('\nDone.\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
