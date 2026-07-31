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

function isStructuralRoot(code) {
  return ['1000', '2000', '3000', '4000', '5000'].includes(String(code || '').trim());
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

function groupDuplicates(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({
      key,
      count: list.length,
      accounts: list.map((a) => ({
        id: a.id,
        code: accountCode(a),
        name: accountName(a),
        type: a.accountType || a.type,
        isActive: a.isActive,
      })),
    }));
}

async function groupedPostedLines(tenantId, accountIds) {
  if (!accountIds.length) return new Map();

  const [transactionRows, journalRows] = await Promise.all([
    prisma.transactionLine.groupBy({
      by: ['accountId'],
      where: {
        accountId: { in: accountIds },
        transaction: {
          tenantId,
          status: { in: POSTED_TRANSACTION_STATUSES },
        },
      },
      _count: { _all: true },
      _sum: { debitAmount: true, creditAmount: true },
    }),
    prisma.journalEntryLine.groupBy({
      by: ['accountId'],
      where: {
        accountId: { in: accountIds },
        journalEntry: {
          tenantId,
          status: { in: POSTED_JOURNAL_STATUSES },
          transactionId: null,
        },
      },
      _count: { _all: true },
      _sum: { debitAmount: true, creditAmount: true },
    }),
  ]);

  const map = new Map();
  const add = (row, source) => {
    const existing = map.get(row.accountId) || {
      transactionLineCount: 0,
      journalEntryLineCount: 0,
      debitAmount: 0,
      creditAmount: 0,
    };
    if (source === 'transaction') existing.transactionLineCount += row._count?._all || 0;
    if (source === 'journal') existing.journalEntryLineCount += row._count?._all || 0;
    existing.debitAmount += Number(row._sum?.debitAmount || 0);
    existing.creditAmount += Number(row._sum?.creditAmount || 0);
    map.set(row.accountId, existing);
  };

  transactionRows.forEach((row) => add(row, 'transaction'));
  journalRows.forEach((row) => add(row, 'journal'));
  return map;
}

async function salaryAffectedCounts(tenantId, accountIds) {
  if (!accountIds.length) return {};
  const [
    transactionLines,
    journalEntryLines,
    expenses,
    recurringExpenses,
    budgetItems,
    bfExpenseBudgetLines,
  ] = await Promise.all([
    prisma.transactionLine.count({
      where: {
        accountId: { in: accountIds },
        transaction: { tenantId, status: { in: POSTED_TRANSACTION_STATUSES } },
      },
    }),
    prisma.journalEntryLine.count({
      where: {
        accountId: { in: accountIds },
        journalEntry: { tenantId, status: { in: POSTED_JOURNAL_STATUSES } },
      },
    }),
    prisma.expense.count({ where: { tenantId, expenseAccountId: { in: accountIds } } }),
    prisma.recurringExpense.count({ where: { tenantId, expenseAccountId: { in: accountIds } } }),
    prisma.legacyBudgetItem.count({ where: { accountId: { in: accountIds }, budget: { tenantId } } }), // relation field: budget on LegacyBudgetItem
    prisma.bfExpenseBudgetLine.count({
      where: { accountId: { in: accountIds }, header: { tenantId } },
    }),
  ]);
  return {
    transactionLines,
    journalEntryLines,
    expenses,
    recurringExpenses,
    budgetItems,
    bfExpenseBudgetLines,
  };
}

async function duplicatePostedSources(tenantId) {
  const rows = await prisma.transaction.findMany({
    where: {
      tenantId,
      status: { in: POSTED_TRANSACTION_STATUSES },
      isReversal: false,
      sourceType: { not: null },
      sourceId: { not: null },
    },
    select: { id: true, sourceType: true, sourceId: true, reference: true },
  });

  const groups = new Map();
  for (const row of rows) {
    const key = `${row.sourceType}:${row.sourceId}`;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }

  return [...groups.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({
      key,
      sourceType: list[0].sourceType,
      sourceId: list[0].sourceId,
      count: list.length,
      transactions: list,
    }));
}

async function auditTenant(tenant) {
  const accounts = await prisma.account.findMany({
    where: { tenantId: tenant.id },
    include: {
      _count: {
        select: {
          childAccounts: { where: { isActive: true } },
        },
      },
    },
    orderBy: [{ accountCode: 'asc' }, { accountName: 'asc' }],
  });
  const accountIds = accounts.map((a) => a.id);
  const postedLineMap = await groupedPostedLines(tenant.id, accountIds);
  const salaryAccounts = accounts.filter(isSalaryLike);
  const salaryAccountIds = salaryAccounts.map((a) => a.id);

  const expenseRefs = await prisma.expense.findMany({
    where: { tenantId: tenant.id, expenseAccountId: { not: null } },
    select: { id: true, expenseAccountId: true },
  });
  const accountIdSet = new Set(accountIds);

  return {
    tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain },
    duplicateCodes: groupDuplicates(accounts, (a) => accountCode(a)),
    duplicateNamesByType: groupDuplicates(accounts, (a) => {
      const name = accountName(a).toLowerCase();
      const type = String(a.accountType || a.type || '').toLowerCase();
      return name && type ? `${type}:${name}` : null;
    }),
    inactiveAccountsWithPostings: accounts
      .filter((a) => a.isActive === false && postedLineMap.has(a.id))
      .map((a) => ({ id: a.id, code: accountCode(a), name: accountName(a), postings: postedLineMap.get(a.id) })),
    parentOrHeaderDirectPostings: accounts
      .filter((a) => (isStructuralRoot(accountCode(a)) || (a._count?.childAccounts || 0) > 0) && postedLineMap.has(a.id))
      .map((a) => ({
        id: a.id,
        code: accountCode(a),
        name: accountName(a),
        activeChildCount: a._count?.childAccounts || 0,
        postings: postedLineMap.get(a.id),
      })),
    orphanExpenseAccountReferences: expenseRefs
      .filter((row) => row.expenseAccountId && !accountIdSet.has(row.expenseAccountId))
      .slice(0, 100),
    expensesWithoutExpenseAccountId: await prisma.expense.count({
      where: { tenantId: tenant.id, expenseAccountId: null },
    }),
    salaryLikeAccounts: salaryAccounts.map((a) => ({
      id: a.id,
      code: accountCode(a),
      name: accountName(a),
      isActive: a.isActive,
      acceptsNewTransactions: a.acceptsNewTransactions,
      visibleInChart: a.visibleInChart,
      postings: postedLineMap.get(a.id) || null,
    })),
    salaryAffectedCounts: await salaryAffectedCounts(tenant.id, salaryAccountIds),
    duplicatePostedSources: await duplicatePostedSources(tenant.id),
  };
}

async function main() {
  const tenantId = argValue('--tenant');
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
    mode: 'audit',
    tenantFilter: tenantId || null,
    tenants: [],
  };

  for (const tenant of tenants) {
    console.log(`Auditing tenant ${tenant.name || tenant.id}...`);
    report.tenants.push(await auditTenant(tenant));
  }

  const outDir = path.join(process.cwd(), 'tmp');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(outDir, `accounting-audit-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`Accounting mapping audit written to ${outPath}`);
}

main()
  .catch((error) => {
    console.error('Accounting mapping audit failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
