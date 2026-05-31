#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const POSTED_TRANSACTION_STATUSES = ['posted', 'Posted'];
const POSTED_JOURNAL_STATUSES = ['Posted', 'posted'];
const CANONICAL_SALARY_CODE = '5200';
const CANONICAL_SALARY_NAME = 'Salaries & Wages';

function hasArg(name) {
  return process.argv.includes(name);
}

function argValue(name) {
  const prefix = `${name}=`;
  const hit = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function accountCode(account) {
  return String(account?.accountCode || account?.code || '').trim();
}

function accountName(account) {
  return String(account?.accountName || account?.name || '').trim();
}

function isExpense(account) {
  const type = String(account?.accountType || account?.type || '').toLowerCase();
  return type === 'expense' || type === 'exp';
}

function isSalaryLike(account) {
  if (!account) return false;
  const code = accountCode(account);
  if (code === CANONICAL_SALARY_CODE) return false;
  const name = accountName(account).toLowerCase();
  const hasExpenseType = isExpense(account);
  const hasNoType = !String(account?.accountType || account?.type || '').trim();
  if (!hasExpenseType && !(hasNoType && !code)) return false;
  if (name.includes('cost of goods') || name.includes('cogs')) return false;
  if (['5201', '5202', '5203', '5230'].includes(code)) return true;
  if (code === '5301' && /\b(salar(?:y|ies)|wages?)\b/i.test(name)) return true;
  if (code === '5210' && /(employer|paye|nps|pension|contribution|benefit|payroll)/i.test(name)) {
    return true;
  }
  return /\b(salar(?:y|ies)|wages?|payroll|staff compensation|employee compensation|remuneration)\b/i.test(name);
}

const ROW_SPECS = [
  {
    entityType: 'TransactionLine',
    delegate: 'transactionLine',
    fieldName: 'accountId',
    where: (tenantId, accountIds) => ({
      accountId: { in: accountIds },
      transaction: { tenantId },
    }),
  },
  {
    entityType: 'JournalEntry',
    delegate: 'journalEntry',
    fieldName: 'accountId',
    where: (tenantId, accountIds) => ({ tenantId, accountId: { in: accountIds } }),
  },
  {
    entityType: 'JournalEntryLine',
    delegate: 'journalEntryLine',
    fieldName: 'accountId',
    where: (tenantId, accountIds) => ({
      accountId: { in: accountIds },
      journalEntry: { tenantId },
    }),
  },
  {
    entityType: 'Expense',
    delegate: 'expense',
    fieldName: 'expenseAccountId',
    where: (tenantId, accountIds) => ({ tenantId, expenseAccountId: { in: accountIds } }),
  },
  {
    entityType: 'SupplierBillItem',
    delegate: 'supplierBillItem',
    fieldName: 'expenseAccountId',
    where: (tenantId, accountIds) => ({
      expenseAccountId: { in: accountIds },
      bill: { tenantId },
    }),
  },
  {
    entityType: 'RecurringExpense',
    delegate: 'recurringExpense',
    fieldName: 'expenseAccountId',
    where: (tenantId, accountIds) => ({ tenantId, expenseAccountId: { in: accountIds } }),
  },
  {
    entityType: 'BudgetItem',
    delegate: 'budgetItem',
    fieldName: 'accountId',
    where: (tenantId, accountIds) => ({ accountId: { in: accountIds }, budget: { tenantId } }),
  },
  {
    entityType: 'BfExpenseBudgetLine',
    delegate: 'bfExpenseBudgetLine',
    fieldName: 'accountId',
    where: (tenantId, accountIds) => ({ accountId: { in: accountIds }, header: { tenantId } }),
  },
];

async function getTenantTargets(db, tenantId) {
  const accounts = await db.account.findMany({
    where: { tenantId },
    select: {
      id: true,
      tenantId: true,
      accountCode: true,
      code: true,
      accountName: true,
      name: true,
      accountType: true,
      type: true,
      isActive: true,
      acceptsNewTransactions: true,
      visibleInChart: true,
      mergedIntoAccountId: true,
    },
  });
  const canonical = accounts.find((a) => accountCode(a) === CANONICAL_SALARY_CODE);
  const duplicateSalaryAccounts = accounts.filter(isSalaryLike);
  return { accounts, canonical, duplicateSalaryAccounts };
}

async function planTenant(tenant) {
  const { accounts, canonical, duplicateSalaryAccounts } = await getTenantTargets(prisma, tenant.id);
  const accountIds = duplicateSalaryAccounts.map((a) => a.id);
  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const affectedRows = {};

  for (const spec of ROW_SPECS) {
    const rows = accountIds.length
      ? await prisma[spec.delegate].findMany({
          where: spec.where(tenant.id, accountIds),
          select: { id: true, [spec.fieldName]: true },
          take: 5000,
        })
      : [];
    affectedRows[spec.entityType] = {
      count: rows.length,
      sample: rows.slice(0, 20).map((row) => ({
        id: row.id,
        oldAccountId: row[spec.fieldName],
        oldAccountCode: accountCode(accountsById.get(row[spec.fieldName])),
        oldAccountName: accountName(accountsById.get(row[spec.fieldName])),
      })),
    };
  }

  return {
    tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain },
    canonical: canonical
      ? { id: canonical.id, code: accountCode(canonical), name: accountName(canonical) }
      : null,
    duplicateSalaryAccounts: duplicateSalaryAccounts.map((a) => ({
      id: a.id,
      code: accountCode(a),
      name: accountName(a),
      isActive: a.isActive,
      acceptsNewTransactions: a.acceptsNewTransactions,
      visibleInChart: a.visibleInChart,
      mergedIntoAccountId: a.mergedIntoAccountId,
    })),
    affectedRows,
    errors: canonical ? [] : [`Missing ${CANONICAL_SALARY_CODE} - ${CANONICAL_SALARY_NAME}`],
  };
}

async function recalculateExpenseBalances(db, tenantId, accountIds) {
  if (!accountIds.length) return;

  const [transactionRows, journalRows] = await Promise.all([
    db.transactionLine.groupBy({
      by: ['accountId'],
      where: {
        accountId: { in: accountIds },
        transaction: {
          tenantId,
          status: { in: POSTED_TRANSACTION_STATUSES },
        },
      },
      _sum: { debitAmount: true, creditAmount: true },
    }),
    db.journalEntryLine.groupBy({
      by: ['accountId'],
      where: {
        accountId: { in: accountIds },
        journalEntry: {
          tenantId,
          status: { in: POSTED_JOURNAL_STATUSES },
          transactionId: null,
        },
      },
      _sum: { debitAmount: true, creditAmount: true },
    }),
  ]);

  const totals = new Map(accountIds.map((id) => [id, { debit: 0, credit: 0 }]));
  for (const row of [...transactionRows, ...journalRows]) {
    const existing = totals.get(row.accountId) || { debit: 0, credit: 0 };
    existing.debit += Number(row._sum?.debitAmount || 0);
    existing.credit += Number(row._sum?.creditAmount || 0);
    totals.set(row.accountId, existing);
  }

  for (const [accountId, total] of totals.entries()) {
    await db.account.update({
      where: { id: accountId },
      data: { balance: total.debit - total.credit },
    });
  }
}

async function applyTenant(tenant, batchId) {
  return prisma.$transaction(async (tx) => {
    const { accounts, canonical, duplicateSalaryAccounts } = await getTenantTargets(tx, tenant.id);
    if (!canonical) {
      return {
        tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain },
        applied: false,
        errors: [`Missing ${CANONICAL_SALARY_CODE} - ${CANONICAL_SALARY_NAME}`],
      };
    }

    const oldAccountIds = duplicateSalaryAccounts.map((a) => a.id);
    if (!oldAccountIds.length) {
      return {
        tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain },
        applied: true,
        changedRows: {},
        retiredAccounts: 0,
        message: 'No duplicate salary accounts found.',
      };
    }

    const accountsById = new Map(accounts.map((a) => [a.id, a]));
    const changedRows = {};

    for (const spec of ROW_SPECS) {
      const rows = await tx[spec.delegate].findMany({
        where: spec.where(tenant.id, oldAccountIds),
        select: { id: true, [spec.fieldName]: true },
      });

      changedRows[spec.entityType] = rows.length;
      if (!rows.length) continue;

      await tx.accountingMappingCorrection.createMany({
        data: rows.map((row) => {
          const oldAccount = accountsById.get(row[spec.fieldName]);
          return {
            tenantId: tenant.id,
            batchId,
            entityType: spec.entityType,
            entityId: row.id,
            fieldName: spec.fieldName,
            oldAccountId: row[spec.fieldName],
            oldAccountCode: accountCode(oldAccount),
            oldAccountName: accountName(oldAccount),
            newAccountId: canonical.id,
            newAccountCode: accountCode(canonical),
            newAccountName: accountName(canonical),
            reason: `Remap duplicate salary/payroll expense account to ${CANONICAL_SALARY_CODE} - ${CANONICAL_SALARY_NAME}`,
          };
        }),
      });

      await tx[spec.delegate].updateMany({
        where: { id: { in: rows.map((row) => row.id) } },
        data: { [spec.fieldName]: canonical.id },
      });
    }

    const retired = await tx.account.updateMany({
      where: { id: { in: oldAccountIds }, tenantId: tenant.id },
      data: {
        isActive: false,
        acceptsNewTransactions: false,
        visibleInChart: false,
        mergedIntoAccountId: canonical.id,
        retiredAt: new Date(),
        migratedToAccountCode: CANONICAL_SALARY_CODE,
      },
    });

    await recalculateExpenseBalances(tx, tenant.id, [canonical.id, ...oldAccountIds]);

    return {
      tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain },
      applied: true,
      changedRows,
      retiredAccounts: retired.count,
      canonical: { id: canonical.id, code: accountCode(canonical), name: accountName(canonical) },
      duplicateSalaryAccountIds: oldAccountIds,
    };
  }, { timeout: 120000 });
}

function writeReport(prefix, report) {
  const outDir = path.join(process.cwd(), 'tmp');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(outDir, `${prefix}-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  return outPath;
}

async function main() {
  const apply = hasArg('--apply');
  const dryRun = hasArg('--dry-run') || !apply;
  const tenantId = argValue('--tenant');
  const batchId = argValue('--batch') || `accounting-remap-${new Date().toISOString()}`;

  if (apply && !hasArg('--backup-confirmed')) {
    throw new Error('Apply mode requires --backup-confirmed.');
  }

  const tenants = await prisma.tenant.findMany({
    where: tenantId ? { id: tenantId } : {},
    select: { id: true, name: true, subdomain: true },
    orderBy: { name: 'asc' },
  });

  if (tenantId && tenants.length === 0) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: dryRun ? 'dry-run' : 'apply',
    tenantFilter: tenantId || null,
    batchId,
    tenants: [],
  };

  if (dryRun) {
    for (const tenant of tenants) {
      console.log(`Planning remap for tenant ${tenant.name || tenant.id}...`);
      report.tenants.push(await planTenant(tenant));
    }
    const outPath = writeReport('accounting-remap-dry-run', report);
    console.log(`Accounting mapping remap dry-run written to ${outPath}`);
    return;
  }

  for (const tenant of tenants) {
    console.log(`Applying remap for tenant ${tenant.name || tenant.id}...`);
    report.tenants.push(await applyTenant(tenant, batchId));
  }
  const outPath = writeReport('accounting-remap-apply', report);
  console.log(`Accounting mapping remap apply report written to ${outPath}`);
}

main()
  .catch((error) => {
    console.error('Accounting mapping remap failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
