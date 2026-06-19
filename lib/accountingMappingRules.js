import prisma from '@/lib/prisma';
import { accountBlocksDirectPosting, coaAccountDisplayLabel } from '@/lib/coaDirectPostingEligibility';
import { classifyCoaBucketByCode, primaryNumericFromAccountCode } from '@/lib/coaMigration/classifyRange.js';
import { DUPLICATE_SALARY_ACCOUNT_CODE } from '@/lib/salaryExpenseAccountCodes.js';

export const CANONICAL_SALARY_ACCOUNT_CODE = '5200';
export const CANONICAL_SALARY_ACCOUNT_NAME = 'Salaries & Wages';

const LEGACY_SALARY_ACCOUNT_CODES = new Set(['5201', '5202', '5203', '5230', DUPLICATE_SALARY_ACCOUNT_CODE]);

function codeOf(account) {
  return String(account?.accountCode ?? account?.code ?? '').trim();
}

function nameOf(account) {
  return String(account?.accountName ?? account?.name ?? '').trim();
}

function typeOf(account) {
  return String(account?.accountType ?? account?.type ?? '').trim();
}

function lowerName(account) {
  return nameOf(account).toLowerCase();
}

export function normalizeAccountCode(code) {
  return String(code ?? '').trim().replace(/\s+/g, '');
}

export function isExpenseAccountCodeRange(code) {
  return classifyCoaBucketByCode(code) === 'Expense';
}

export function isCanonicalSalaryExpenseAccount(account) {
  return (
    normalizeAccountCode(codeOf(account)) === CANONICAL_SALARY_ACCOUNT_CODE &&
    typeOf(account).toLowerCase() === 'expense' &&
    isExpenseAccountCodeRange(codeOf(account))
  );
}

export function isSalaryLikeExpenseAccount(account) {
  if (!account || typeOf(account).toLowerCase() !== 'expense') return false;
  if (isCanonicalSalaryExpenseAccount(account)) return false;

  const code = normalizeAccountCode(codeOf(account));
  const name = lowerName(account);
  if (name.includes('cost of goods') || name.includes('cogs')) return false;

  if (LEGACY_SALARY_ACCOUNT_CODES.has(code)) return true;
  if (code === '5301' && /\b(salar(?:y|ies)|wages?)\b/i.test(name)) return true;
  if (code === '5210' && /(employer|paye|nps|pension|contribution|benefit|payroll)/i.test(name)) {
    return true;
  }

  return /\b(salar(?:y|ies)|wages?|payroll|staff compensation|employee compensation|remuneration)\b/i.test(name);
}

export function isPostableExpenseAccount(account, options = {}) {
  if (!account) return false;
  if (account.tenantId != null && options.tenantId != null && account.tenantId !== options.tenantId) {
    return false;
  }
  if (account.isActive === false) return false;
  if (account.visibleInChart === false) return false;
  if (account.mergedIntoAccountId) return false;
  if (typeOf(account).toLowerCase() !== 'expense') return false;
  if (!isExpenseAccountCodeRange(codeOf(account))) return false;
  if (accountBlocksDirectPosting(account, options).blocked) return false;
  return true;
}

export function getExpenseAccountValidationError(account, options = {}) {
  if (!account) {
    return 'Invalid expense account. Select an active Chart of Accounts expense account.';
  }

  const label = coaAccountDisplayLabel(account) || account.id || 'Selected account';
  if (account.tenantId != null && options.tenantId != null && account.tenantId !== options.tenantId) {
    return 'Invalid expense account. The selected account belongs to another tenant.';
  }
  if (account.isActive === false) {
    return `Cannot post expenses to "${label}" because the account is inactive.`;
  }
  if (account.visibleInChart === false) {
    return `Cannot post expenses to "${label}" because the account is hidden from the active chart.`;
  }
  if (account.mergedIntoAccountId) {
    return `Cannot post expenses to "${label}" because the account has been merged into another account.`;
  }
  if (typeOf(account).toLowerCase() !== 'expense') {
    return `Cannot post expenses to "${label}" because it is not an Expense account.`;
  }
  if (!isExpenseAccountCodeRange(codeOf(account))) {
    const code = codeOf(account) || '(no code)';
    const numeric = primaryNumericFromAccountCode(code);
    const rangeHint = Number.isFinite(numeric)
      ? `Code ${code} is outside the 5000-5999 expense range.`
      : `Code ${code} is not a valid numeric expense code.`;
    return `Cannot post expenses to "${label}". ${rangeHint}`;
  }
  const directPosting = accountBlocksDirectPosting(account, options);
  if (directPosting.blocked) {
    return `Cannot post expenses to "${directPosting.details || label}". ${directPosting.reason}`;
  }
  if (isSalaryLikeExpenseAccount(account)) {
    return `Salary and payroll expenses must use ${CANONICAL_SALARY_ACCOUNT_CODE} - ${CANONICAL_SALARY_ACCOUNT_NAME}.`;
  }
  return null;
}

export function toExpenseAccountOption(account) {
  const code = codeOf(account);
  const name = nameOf(account) || code || 'Unnamed account';
  return {
    id: account.id,
    accountId: account.id,
    code,
    accountCode: code,
    name,
    accountName: name,
    account: {
      ...account,
      accountCode: code,
      accountName: name,
    },
    expenseCategoryId: null,
    description: account.description ?? null,
  };
}

export async function getPostableExpenseAccounts(tenantId, db = prisma) {
  const accounts = await db.account.findMany({
    where: {
      tenantId,
      isActive: true,
      mergedIntoAccountId: null,
      OR: [
        { accountType: { equals: 'Expense', mode: 'insensitive' } },
        { type: { equals: 'EXPENSE', mode: 'insensitive' } },
        { type: { equals: 'Expense', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      tenantId: true,
      accountCode: true,
      code: true,
      accountName: true,
      name: true,
      accountType: true,
      accountSubtype: true,
      description: true,
      isActive: true,
      mergedIntoAccountId: true,
      acceptsNewTransactions: true,
      visibleInChart: true,
      _count: {
        select: {
          childAccounts: { where: { isActive: true } },
        },
      },
    },
    orderBy: [{ accountCode: 'asc' }, { accountName: 'asc' }],
  });

  return accounts
    .filter((account) => isPostableExpenseAccount(account, { tenantId }))
    .filter((account) => !isSalaryLikeExpenseAccount(account) || isCanonicalSalaryExpenseAccount(account))
    .sort((a, b) => codeOf(a).localeCompare(codeOf(b), undefined, { numeric: true }));
}

export async function getPostableExpenseAccountOptions(tenantId, db = prisma) {
  const accounts = await getPostableExpenseAccounts(tenantId, db);
  return accounts.map(toExpenseAccountOption);
}

export async function resolvePostableExpenseAccount(tenantId, accountId, db = prisma) {
  if (!accountId) {
    throw new Error('Expense account is required.');
  }

  const account = await db.account.findFirst({
    where: { id: accountId, tenantId },
    select: {
      id: true,
      tenantId: true,
      accountCode: true,
      code: true,
      accountName: true,
      name: true,
      accountType: true,
      accountSubtype: true,
      description: true,
      isActive: true,
      mergedIntoAccountId: true,
      acceptsNewTransactions: true,
      visibleInChart: true,
      _count: {
        select: {
          childAccounts: { where: { isActive: true } },
        },
      },
    },
  });

  const error = getExpenseAccountValidationError(account, { tenantId });
  if (error) throw new Error(error);
  return account;
}

export async function resolveExpenseAccountSelection(tenantId, selection = {}, db = prisma) {
  const { expenseAccountId, category } = selection;
  let legacyExpenseCategory = null;

  if (expenseAccountId) {
    const account = await db.account.findFirst({
      where: { id: expenseAccountId, tenantId },
      select: { id: true },
    });
    if (account) {
      const resolved = await resolvePostableExpenseAccount(tenantId, account.id, db);
      return { account: resolved, expenseCategory: null, categoryName: nameOf(resolved) };
    }

    legacyExpenseCategory = await db.expenseCategory.findFirst({
      where: { id: expenseAccountId, tenantId },
      include: { account: true },
    });
    if (legacyExpenseCategory?.accountId) {
      const resolved = await resolvePostableExpenseAccount(tenantId, legacyExpenseCategory.accountId, db);
      return {
        account: resolved,
        expenseCategory: legacyExpenseCategory,
        categoryName: legacyExpenseCategory.name || nameOf(resolved),
      };
    }
  }

  if (category) {
    legacyExpenseCategory = await db.expenseCategory.findFirst({
      where: { tenantId, name: { equals: category, mode: 'insensitive' } },
      include: { account: true },
    });
    if (legacyExpenseCategory?.accountId) {
      const resolved = await resolvePostableExpenseAccount(tenantId, legacyExpenseCategory.accountId, db);
      return {
        account: resolved,
        expenseCategory: legacyExpenseCategory,
        categoryName: legacyExpenseCategory.name || nameOf(resolved),
      };
    }

    const account = await db.account.findFirst({
      where: {
        tenantId,
        accountType: 'Expense',
        accountName: { equals: category, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (account) {
      const resolved = await resolvePostableExpenseAccount(tenantId, account.id, db);
      return { account: resolved, expenseCategory: null, categoryName: nameOf(resolved) };
    }
  }

  throw new Error('Invalid expense account. Select an active postable expense account from Chart of Accounts.');
}

export async function resolveCanonicalSalaryExpenseAccount(tenantId, db = prisma) {
  const account = await db.account.findFirst({
    where: {
      tenantId,
      accountCode: CANONICAL_SALARY_ACCOUNT_CODE,
      accountType: 'Expense',
    },
    select: {
      id: true,
      tenantId: true,
      accountCode: true,
      code: true,
      accountName: true,
      name: true,
      accountType: true,
      accountSubtype: true,
      description: true,
      isActive: true,
      mergedIntoAccountId: true,
      acceptsNewTransactions: true,
      visibleInChart: true,
      _count: {
        select: {
          childAccounts: { where: { isActive: true } },
        },
      },
    },
  });

  if (!account) {
    throw new Error(`${CANONICAL_SALARY_ACCOUNT_CODE} - ${CANONICAL_SALARY_ACCOUNT_NAME} is required for payroll.`);
  }

  const directPosting = accountBlocksDirectPosting(account);
  if (
    !isCanonicalSalaryExpenseAccount(account) ||
    account.isActive === false ||
    account.visibleInChart === false ||
    account.mergedIntoAccountId ||
    directPosting.blocked
  ) {
    const reason = getExpenseAccountValidationError(account) || directPosting.reason;
    throw new Error(`${CANONICAL_SALARY_ACCOUNT_CODE} - ${CANONICAL_SALARY_ACCOUNT_NAME} cannot receive payroll postings. ${reason || ''}`.trim());
  }

  return account;
}

export async function assertNoDuplicatePostedSource({
  tenantId,
  sourceType,
  sourceId,
  excludeTransactionId = null,
  db = prisma,
}) {
  if (!tenantId || !sourceType || !sourceId) return;

  const count = await db.transaction.count({
    where: {
      tenantId,
      sourceType,
      sourceId,
      status: { in: ['posted', 'Posted'] },
      isReversal: false,
      ...(excludeTransactionId ? { id: { not: excludeTransactionId } } : {}),
    },
  });

  if (count > 0) {
    throw new Error(`Duplicate posted GL source detected for ${sourceType} ${sourceId}.`);
  }
}
