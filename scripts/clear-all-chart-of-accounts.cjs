#!/usr/bin/env node
/**
 * Remove all Chart of Accounts rows, global system CoA template, and CoA-related metadata.
 * Clears GL account links on related entities so CoA can be re-implemented from scratch.
 * Does NOT delete tenants, users, or operational transactions (will fail if GL lines exist).
 *
 * Usage:
 *   node scripts/clear-all-chart-of-accounts.cjs [--tenantId=...] [--execute]
 *
 * Default is dry-run. Pass --execute to apply.
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

const dryRun = !process.argv.includes('--execute');
const tenantIdFilter = arg('tenantId');

async function countBlockingGl(tenantId) {
  const where = tenantId ? { tenantId } : {};
  const [txnLines, jeLines] = await Promise.all([
    prisma.transactionLine.count({
      where: tenantId
        ? { transaction: { tenantId } }
        : {},
    }),
    prisma.journalEntryLine.count({
      where: tenantId ? { journalEntry: { tenantId } } : {},
    }),
  ]);
  return txnLines + jeLines;
}

async function clearCoaForScope(tenantWhere) {
  const accountWhere = tenantWhere.tenantId ? { tenantId: tenantWhere.tenantId } : {};

  const accounts = await prisma.account.findMany({
    where: accountWhere,
    select: { id: true, accountCode: true, tenantId: true },
  });
  const accountIds = accounts.map((a) => a.id);

  const blocking = accountIds.length
    ? await countBlockingGl(tenantWhere.tenantId || null)
    : 0;
  if (blocking > 0) {
    throw new Error(
      `Cannot clear CoA: ${blocking} posted GL line(s) still reference accounts. Remove transactions first.`
    );
  }

  const ops = [];

  const run = async (label, fn) => {
    if (dryRun) {
      ops.push(`[dry-run] ${label}`);
      return 0;
    }
    const n = await fn();
    ops.push(`${label}: ${n}`);
    return n;
  };

  await run('Clear tenantSettings tax/inventory account links', () =>
    prisma.tenantSettings.updateMany({
      where: tenantWhere.tenantId ? { tenantId: tenantWhere.tenantId } : {},
      data: {
        taxInflowAccountId: null,
        taxOutflowAccountId: null,
        inventoryAdjustmentLossAccountId: null,
        paymentAccountsSetupCompletedAt: null,
      },
    }).then((r) => r.count)
  );

  await run('Clear paymentAccount coaAccountId', () =>
    prisma.paymentAccount.updateMany({
      where: tenantWhere.tenantId ? { tenantId: tenantWhere.tenantId } : {},
      data: { coaAccountId: null },
    }).then((r) => r.count)
  );

  await run('Clear bankAccount coaAccountId', () =>
    prisma.bankAccount.updateMany({
      where: tenantWhere.tenantId ? { tenantId: tenantWhere.tenantId } : {},
      data: { coaAccountId: null },
    }).then((r) => r.count)
  );

  await run('Clear equityAccount coaAccountId', () =>
    prisma.equityAccount.updateMany({
      where: tenantWhere.tenantId ? { tenantId: tenantWhere.tenantId } : {},
      data: { coaAccountId: null },
    }).then((r) => r.count)
  );

  await run('Clear invoiceItem accountId', () =>
    prisma.invoiceItem.updateMany({
      where: tenantWhere.tenantId
        ? { invoice: { tenantId: tenantWhere.tenantId } }
        : {},
      data: { accountId: null },
    }).then((r) => r.count)
  );

  await run('Clear saleItem accountId', () =>
    prisma.saleItem.updateMany({
      where: tenantWhere.tenantId ? { sale: { tenantId: tenantWhere.tenantId } } : {},
      data: { accountId: null },
    }).then((r) => r.count)
  );

  await run('Clear product account links', () =>
    prisma.product.updateMany({
      where: tenantWhere.tenantId ? { tenantId: tenantWhere.tenantId } : {},
      data: {
        incomeAccountId: null,
        cogsAccountId: null,
        inventoryAccountId: null,
      },
    }).then((r) => r.count)
  );

  await run('Clear expense account links', () =>
    prisma.expense.updateMany({
      where: tenantWhere.tenantId ? { tenantId: tenantWhere.tenantId } : {},
      data: { expenseAccountId: null, sourceAccountId: null },
    }).then((r) => r.count)
  );

  await run('Clear recurringExpense account links', () =>
    prisma.recurringExpense.updateMany({
      where: tenantWhere.tenantId ? { tenantId: tenantWhere.tenantId } : {},
      data: { expenseAccountId: null },
    }).then((r) => r.count)
  );

  await run('Clear asset glAccountId', () =>
    prisma.asset.updateMany({
      where: tenantWhere.tenantId ? { tenantId: tenantWhere.tenantId } : {},
      data: { glAccountId: null },
    }).then((r) => r.count)
  );

  await run('Clear liability glAccountId', () =>
    prisma.liability.updateMany({
      where: tenantWhere.tenantId ? { tenantId: tenantWhere.tenantId } : {},
      data: { glAccountId: null },
    }).then((r) => r.count)
  );

  await run('Delete taxType rows linked to CoA', () =>
    prisma.taxType.deleteMany({
      where: tenantWhere.tenantId ? { tenantId: tenantWhere.tenantId } : {},
    }).then((r) => r.count)
  );

  await run('Delete budgetItem rows linked to CoA', () =>
    prisma.budgetItem.deleteMany({
      where: tenantWhere.tenantId ? { budget: { tenantId: tenantWhere.tenantId } } : {},
    }).then((r) => r.count)
  );

  await run('Delete bfExpenseBudgetLine', () =>
    prisma.bfExpenseBudgetLine.deleteMany({
      where: accountIds.length ? { accountId: { in: accountIds } } : {},
    }).then((r) => r.count)
  );

  await run('Delete bfRevenueForecastLine', () =>
    prisma.bfRevenueForecastLine.deleteMany({
      where: accountIds.length ? { accountId: { in: accountIds } } : {},
    }).then((r) => r.count)
  );

  await run('Delete coaMigrationLog', () =>
    prisma.coaMigrationLog.deleteMany({
      where: tenantWhere.tenantId ? { tenantId: tenantWhere.tenantId } : {},
    }).then((r) => r.count)
  );

  await run('Delete accountingMappingCorrection', () =>
    prisma.accountingMappingCorrection.deleteMany({
      where: tenantWhere.tenantId ? { tenantId: tenantWhere.tenantId } : {},
    }).then((r) => r.count)
  );

  await run('Delete expenseCategory', () =>
    prisma.expenseCategory.deleteMany({
      where: tenantWhere.tenantId ? { tenantId: tenantWhere.tenantId } : {},
    }).then((r) => r.count)
  );

  await run('Delete accountBalanceHistory', () =>
    prisma.accountBalanceHistory.deleteMany({
      where: accountIds.length ? { accountId: { in: accountIds } } : {},
    }).then((r) => r.count)
  );

  await run('Delete accountBalance', () =>
    prisma.accountBalance.deleteMany({
      where: tenantWhere.tenantId ? { tenantId: tenantWhere.tenantId } : {},
    }).then((r) => r.count)
  );

  await run('Clear journalEntry header accountId', () =>
    prisma.journalEntry.updateMany({
      where: tenantWhere.tenantId ? { tenantId: tenantWhere.tenantId } : {},
      data: { accountId: null },
    }).then((r) => r.count)
  );

  await run('Null account hierarchy before delete', () =>
    prisma.account.updateMany({
      where: accountWhere,
      data: { parentAccountId: null, mergedIntoAccountId: null },
    }).then((r) => r.count)
  );

  const deleted = await run('Delete Account rows', () =>
    prisma.account.deleteMany({ where: accountWhere }).then((r) => r.count)
  );

  return { accounts: deleted || accounts.length, ops };
}

async function clearGlobalCoaArtifacts() {
  const ops = [];
  const globalRun = async (label, fn) => {
    if (dryRun) {
      ops.push(`[dry-run] ${label}`);
      return 0;
    }
    const n = await fn();
    ops.push(`${label}: ${n}`);
    return n;
  };

  await globalRun('Delete systemCoaDefinition (global default template)', () =>
    prisma.systemCoaDefinition.deleteMany({}).then((r) => r.count)
  );

  if (!tenantIdFilter) {
    await globalRun('Delete accountingMappingCorrection (all tenants)', () =>
      prisma.accountingMappingCorrection.deleteMany({}).then((r) => r.count)
    );
    await globalRun('Delete coaMigrationLog (all tenants)', () =>
      prisma.coaMigrationLog.deleteMany({}).then((r) => r.count)
    );
    await globalRun('Delete expenseCategory (all tenants)', () =>
      prisma.expenseCategory.deleteMany({}).then((r) => r.count)
    );
  }

  return ops;
}

async function main() {
  console.log(dryRun ? '\n🔍 DRY RUN — pass --execute to apply\n' : '\n⚠️  EXECUTING CoA wipe\n');

  const tenants = tenantIdFilter
    ? await prisma.tenant.findMany({ where: { id: tenantIdFilter }, select: { id: true, name: true } })
    : await prisma.tenant.findMany({ select: { id: true, name: true } });

  if (!tenants.length) {
    console.log('No tenants matched.');
    process.exit(1);
  }

  let totalAccounts = 0;
  for (const tenant of tenants) {
    console.log(`\nTenant: ${tenant.name} (${tenant.id})`);
    const result = await clearCoaForScope({ tenantId: tenant.id });
    totalAccounts += result.accounts || 0;
    for (const line of result.ops || []) console.log(' ', line);
    if (result.message) console.log(' ', result.message);
  }

  console.log('\nGlobal CoA artifacts:');
  for (const line of await clearGlobalCoaArtifacts()) console.log(' ', line);

  const remaining = await prisma.account.count();
  const systemCoa = await prisma.systemCoaDefinition.count();
  console.log(
    `\n${dryRun ? 'Would remove' : 'Removed'} ~${totalAccounts} account row(s). Remaining accounts: ${remaining}, systemCoaDefinition: ${systemCoa}`
  );
  if (dryRun) console.log('\nRe-run with: node scripts/clear-all-chart-of-accounts.cjs --execute');
}

main()
  .catch((err) => {
    console.error('❌', err.message || err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
