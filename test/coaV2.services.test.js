import { describe, it, expect } from 'vitest';
import {
  findActiveMapping,
  assertMappedAccountUsable,
  resolvePurposeAccount,
  assignMapping,
  normalizePurposeKey,
} from '../lib/coaV2/application/accountMappingRegistry.js';
import {
  MissingAccountMappingError,
  InactiveAccountError,
  NonPostingAccountError,
  CrossTenantAccountingError,
  AccountingValidationError,
} from '../lib/accountingV2/domain/errors.js';
import { getValidExpensePostingAccounts } from '../lib/coaV2/application/expenseAccountQuery.js';
import { isConflictingSalaryAccount, CANONICAL_SALARY_CODE } from '../lib/coaV2/application/salaryAccountEnforcement.js';
import { duplicateRegisterToCsv } from '../lib/coaV2/application/duplicateClassifier.js';

const BUSINESS = 'tenant-a';
const OTHER_BUSINESS = 'tenant-b';
const context = Object.freeze({
  businessId: BUSINESS,
  userId: 'user-1',
  requestId: 'req-1',
  correlationId: 'corr-1',
});

/** Minimal in-memory Prisma stand-in for the tables the registry touches. */
function makeDb({ mappings = [], accounts = [], flags = [] } = {}) {
  const matchIn = (value, condition) =>
    condition == null ||
    (condition.in ? condition.in.includes(value) : condition === value);
  return {
    coaV2AccountMapping: {
      findMany: async ({ where }) =>
        mappings.filter((m) =>
          m.tenantId === where.tenantId &&
          m.purpose === where.purpose &&
          m.status === where.status &&
          matchIn(m.moduleKey, where.moduleKey) &&
          matchIn(m.transactionType, where.transactionType) &&
          matchIn(m.currency, where.currency) &&
          matchIn(m.branchKey, where.branchKey)
        ),
      findUnique: async ({ where }) => {
        const key = where.tenantId_purpose_moduleKey_transactionType_currency_branchKey;
        return mappings.find((m) =>
          m.tenantId === key.tenantId && m.purpose === key.purpose &&
          m.moduleKey === key.moduleKey && m.transactionType === key.transactionType &&
          m.currency === key.currency && m.branchKey === key.branchKey
        ) ?? null;
      },
      upsert: async ({ where, create, update }) => {
        const key = where.tenantId_purpose_moduleKey_transactionType_currency_branchKey;
        const existing = mappings.find((m) =>
          m.tenantId === key.tenantId && m.purpose === key.purpose &&
          m.moduleKey === key.moduleKey && m.transactionType === key.transactionType &&
          m.currency === key.currency && m.branchKey === key.branchKey
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row = { id: `map-${mappings.length + 1}`, priority: 0, ...create };
        mappings.push(row);
        return row;
      },
    },
    account: {
      findFirst: async ({ where }) => {
        const found = accounts.find((a) =>
          (where.id == null || a.id === where.id) &&
          (where.tenantId == null || a.tenantId === where.tenantId)
        );
        if (!found) return null;
        return { ...found, _count: { childAccounts: found.activeChildCount ?? 0 } };
      },
      findMany: async ({ where }) =>
        accounts
          .filter((a) => where?.tenantId == null || a.tenantId === where.tenantId)
          .map((a) => ({ ...a })),
    },
    acctV2FeatureFlag: {
      findMany: async ({ where }) =>
        flags.filter((f) => f.flagKey === where.flagKey),
    },
  };
}

const CANONICAL_ONLY_FLAG = [
  { flagKey: 'coaV2CanonicalMappings', tenantId: '*', moduleKey: '*', eventType: '*', enabled: true },
];

function postingAccount(overrides = {}) {
  return {
    id: 'acc-1',
    tenantId: BUSINESS,
    accountCode: '4100',
    isActive: true,
    coaV2Status: 'ACTIVE',
    coaV2Behaviour: 'POSTING',
    coaV2Category: 'REVENUE',
    coaV2SubType: 'SALES_REVENUE',
    coaV2NormalBalance: 'CREDIT',
    postingAllowed: true,
    activeChildCount: 0,
    ...overrides,
  };
}

function mappingRow(overrides = {}) {
  return {
    id: 'map-1',
    tenantId: BUSINESS,
    purpose: 'SALES_REVENUE',
    accountId: 'acc-1',
    moduleKey: '*',
    transactionType: '*',
    currency: '*',
    branchKey: '*',
    status: 'ACTIVE',
    priority: 0,
    effectiveFrom: null,
    effectiveTo: null,
    ...overrides,
  };
}

/* --------------------------- mapping resolution --------------------------- */

describe('account mapping registry', () => {
  it('resolves a valid mapping to a usable posting account', async () => {
    const db = makeDb({
      mappings: [mappingRow()],
      accounts: [postingAccount()],
      flags: CANONICAL_ONLY_FLAG,
    });
    const account = await resolvePurposeAccount(context, 'SALES_REVENUE', {}, db);
    expect(account.id).toBe('acc-1');
  });

  it('throws a typed error when a required mapping is missing (no fallback)', async () => {
    const db = makeDb({ mappings: [], accounts: [], flags: CANONICAL_ONLY_FLAG });
    await expect(resolvePurposeAccount(context, 'SALES_REVENUE', {}, db))
      .rejects.toBeInstanceOf(MissingAccountMappingError);
  });

  it('prefers the most specific context mapping', async () => {
    const db = makeDb({
      mappings: [
        mappingRow({ id: 'map-default', accountId: 'acc-1' }),
        mappingRow({ id: 'map-pos', accountId: 'acc-2', moduleKey: 'POS' }),
      ],
      accounts: [postingAccount(), postingAccount({ id: 'acc-2', accountCode: '4150' })],
      flags: CANONICAL_ONLY_FLAG,
    });
    const specific = await findActiveMapping(db, context, 'SALES_REVENUE', { module: 'POS' });
    expect(specific.id).toBe('map-pos');
    const fallback = await findActiveMapping(db, context, 'SALES_REVENUE', { module: 'SALES' });
    expect(fallback.id).toBe('map-default');
  });

  it('respects effective-date windows', async () => {
    const past = new Date(Date.now() - 86400000);
    const db = makeDb({
      mappings: [mappingRow({ effectiveTo: past })],
      accounts: [postingAccount()],
      flags: CANONICAL_ONLY_FLAG,
    });
    const row = await findActiveMapping(db, context, 'SALES_REVENUE', {});
    expect(row).toBeNull();
  });

  it('rejects cross-business accounts', () => {
    expect(() =>
      assertMappedAccountUsable(postingAccount({ tenantId: OTHER_BUSINESS }), { purpose: 'X', context })
    ).toThrow(CrossTenantAccountingError);
  });

  it('rejects inactive and archived accounts', () => {
    expect(() =>
      assertMappedAccountUsable(postingAccount({ isActive: false }), { purpose: 'X', context })
    ).toThrow(InactiveAccountError);
    expect(() =>
      assertMappedAccountUsable(postingAccount({ coaV2Status: 'ARCHIVED' }), { purpose: 'X', context })
    ).toThrow(InactiveAccountError);
  });

  it('rejects deprecated accounts for new postings', () => {
    expect(() =>
      assertMappedAccountUsable(postingAccount({ coaV2Status: 'DEPRECATED' }), { purpose: 'X', context })
    ).toThrow(NonPostingAccountError);
  });

  it('rejects header/parent accounts', () => {
    expect(() =>
      assertMappedAccountUsable(postingAccount({ coaV2Behaviour: 'HEADER' }), { purpose: 'X', context })
    ).toThrow(NonPostingAccountError);
    const withChildren = { ...postingAccount(), _count: { childAccounts: 2 } };
    expect(() =>
      assertMappedAccountUsable(withChildren, { purpose: 'X', context })
    ).toThrow(NonPostingAccountError);
  });

  it('accepts Phase 2 legacy mapping keys via normalization', () => {
    expect(normalizePurposeKey('SALARIES_EXPENSE')).toBe('SALARIES_AND_WAGES');
    expect(normalizePurposeKey('DEFAULT_REVENUE')).toBe('SALES_REVENUE');
    expect(normalizePurposeKey('SALES_REVENUE')).toBe('SALES_REVENUE');
  });
});

describe('mapping assignment validation', () => {
  it('rejects unknown purposes', async () => {
    const db = makeDb();
    await expect(assignMapping({ db, context, purpose: 'NOT_A_PURPOSE', accountId: 'acc-1' }))
      .rejects.toBeInstanceOf(AccountingValidationError);
  });

  it('rejects accounts from another business', async () => {
    const db = makeDb({ accounts: [postingAccount({ tenantId: OTHER_BUSINESS })] });
    await expect(assignMapping({ db, context, purpose: 'SALES_REVENUE', accountId: 'acc-1' }))
      .rejects.toBeInstanceOf(CrossTenantAccountingError);
  });

  it('rejects category-incompatible accounts', async () => {
    const db = makeDb({ accounts: [postingAccount({ coaV2Category: 'EQUITY', coaV2SubType: 'OWNER_CAPITAL' })] });
    await expect(assignMapping({ db, context, purpose: 'SALES_REVENUE', accountId: 'acc-1' }))
      .rejects.toBeInstanceOf(AccountingValidationError);
  });

  it('replaces the previous mapping for the same purpose+context (no conflicting duplicates)', async () => {
    const mappings = [mappingRow({ accountId: 'acc-1' })];
    const db = makeDb({
      mappings,
      accounts: [postingAccount({ id: 'acc-2', accountCode: '4150' })],
    });
    const { mapping, previous } = await assignMapping({
      db, context, purpose: 'SALES_REVENUE', accountId: 'acc-2',
    });
    expect(previous).not.toBeNull();
    expect(mapping.accountId).toBe('acc-2');
    expect(mappings.filter((m) => m.status === 'ACTIVE').length).toBe(1);
  });
});

/* ---------------------------- expense selector ---------------------------- */

function expenseChart() {
  return [
    { id: 'h5000', tenantId: BUSINESS, accountCode: '5000', accountName: 'Expenses', accountType: 'Expense', isActive: true, parentAccountId: null, coaV2Category: 'EXPENSE', coaV2Behaviour: 'HEADER', coaV2Status: 'ACTIVE', postingAllowed: false },
    { id: 'p5200', tenantId: BUSINESS, accountCode: '5200', accountName: 'Salaries & Wages', accountType: 'Expense', isActive: true, parentAccountId: 'h5000', coaV2Category: 'EXPENSE', coaV2SubType: 'PAYROLL_EXPENSE', coaV2Behaviour: 'POSTING', coaV2Status: 'ACTIVE', postingAllowed: true, systemPurpose: 'SALARIES_AND_WAGES' },
    { id: 'p5301', tenantId: BUSINESS, accountCode: '5301', accountName: 'Salaries Expense (dup)', accountType: 'Expense', isActive: true, parentAccountId: 'h5000', coaV2Category: 'EXPENSE', coaV2Behaviour: 'POSTING', coaV2Status: 'ACTIVE', postingAllowed: true },
    { id: 'p5310', tenantId: BUSINESS, accountCode: '5310', accountName: 'Electricity', accountType: 'Expense', isActive: true, parentAccountId: 'h5000', coaV2Category: 'EXPENSE', coaV2Behaviour: 'POSTING', coaV2Status: 'ACTIVE', postingAllowed: true },
    { id: 'dep5320', tenantId: BUSINESS, accountCode: '5320', accountName: 'Old Water', accountType: 'Expense', isActive: true, parentAccountId: 'h5000', coaV2Category: 'EXPENSE', coaV2Behaviour: 'POSTING', coaV2Status: 'DEPRECATED', postingAllowed: false },
    { id: 'cos5110', tenantId: BUSINESS, accountCode: '5110', accountName: 'Inventory COGS', accountType: 'Expense', isActive: true, parentAccountId: 'h5000', coaV2Category: 'COST_OF_SALES', coaV2Behaviour: 'POSTING', coaV2Status: 'ACTIVE', postingAllowed: true },
    { id: 'asset1110', tenantId: BUSINESS, accountCode: '1110', accountName: 'Cash', accountType: 'Asset', isActive: true, parentAccountId: null, coaV2Category: 'ASSET', coaV2Behaviour: 'POSTING', coaV2Status: 'ACTIVE', postingAllowed: true },
    { id: 'liab2110', tenantId: BUSINESS, accountCode: '2110', accountName: 'Accounts Payable', accountType: 'Liability', isActive: true, parentAccountId: null, coaV2Category: 'LIABILITY', coaV2Behaviour: 'CONTROL', coaV2Status: 'ACTIVE', postingAllowed: true },
    { id: 'eq3300', tenantId: BUSINESS, accountCode: '3300', accountName: 'Owner Drawings', accountType: 'Equity', isActive: true, parentAccountId: null, coaV2Category: 'EQUITY', coaV2SubType: 'DRAWINGS', coaV2Behaviour: 'POSTING', coaV2Status: 'ACTIVE', postingAllowed: true },
    { id: 'rev4100', tenantId: BUSINESS, accountCode: '4100', accountName: 'Sales Revenue', accountType: 'Income', isActive: true, parentAccountId: null, coaV2Category: 'REVENUE', coaV2Behaviour: 'POSTING', coaV2Status: 'ACTIVE', postingAllowed: true },
    { id: 'foreign', tenantId: OTHER_BUSINESS, accountCode: '5390', accountName: 'Other biz expense', accountType: 'Expense', isActive: true, parentAccountId: null, coaV2Category: 'EXPENSE', coaV2Behaviour: 'POSTING', coaV2Status: 'ACTIVE', postingAllowed: true },
  ];
}

describe('expense-category account query', () => {
  it('returns only valid expense posting accounts', async () => {
    const db = makeDb({ accounts: expenseChart().filter((a) => a.tenantId === BUSINESS) });
    const rows = await getValidExpensePostingAccounts(context, {}, db);
    const codes = rows.map((r) => r.code);

    expect(codes).toContain('5200'); // canonical salaries stays selectable
    expect(codes).toContain('5310'); // ordinary expense
    expect(codes).not.toContain('5000'); // header excluded
    expect(codes).not.toContain('5301'); // conflicting salary duplicate excluded
    expect(codes).not.toContain('5320'); // deprecated excluded
    expect(codes).not.toContain('5110'); // COGS excluded by default
    expect(codes).not.toContain('1110'); // assets excluded
    expect(codes).not.toContain('2110'); // liabilities excluded
    expect(codes).not.toContain('3300'); // drawings excluded
    expect(codes).not.toContain('4100'); // revenue excluded
    expect(codes).not.toContain('5390'); // other business excluded by scope
  });

  it('includes COST_OF_SALES accounts only when explicitly requested', async () => {
    const db = makeDb({ accounts: expenseChart().filter((a) => a.tenantId === BUSINESS) });
    const withCogs = await getValidExpensePostingAccounts(context, { includeCostOfSales: true }, db);
    expect(withCogs.map((r) => r.code)).toContain('5110');
  });
});

/* ------------------------------ salary control ------------------------------ */

describe('salary account enforcement', () => {
  it('identifies known duplicate salary codes without using names', () => {
    expect(CANONICAL_SALARY_CODE).toBe('5200');
    expect(isConflictingSalaryAccount({ accountCode: '5301' })).toBe(true);
    expect(isConflictingSalaryAccount({ accountCode: '5230' })).toBe(true);
    expect(isConflictingSalaryAccount({ accountCode: '5200' })).toBe(false);
    // A random account NAMED "Salaries" is not auto-excluded — flagged for review only.
    expect(isConflictingSalaryAccount({ accountCode: '5390', accountName: 'Salaries misc' })).toBe(false);
  });

  it('salary purpose resolves through the registry with an explicit error when unmapped', async () => {
    const db = makeDb({ mappings: [], accounts: [], flags: CANONICAL_ONLY_FLAG });
    await expect(resolvePurposeAccount(context, 'SALARIES_AND_WAGES', { module: 'PAYROLL' }, db))
      .rejects.toBeInstanceOf(MissingAccountMappingError);
  });

  it('salary purpose never resolves to a liability account', async () => {
    const db = makeDb({
      mappings: [mappingRow({ purpose: 'SALARIES_AND_WAGES', accountId: 'liab-1' })],
      accounts: [postingAccount({ id: 'liab-1', coaV2Category: 'LIABILITY', coaV2NormalBalance: 'CREDIT' })],
    });
    // Mapping row exists but assignment-time validation is the guard:
    await expect(assignMapping({ db, context, purpose: 'SALARIES_AND_WAGES', accountId: 'liab-1' }))
      .rejects.toBeInstanceOf(AccountingValidationError);
  });
});

/* ------------------------------ CSV safety ------------------------------ */

describe('duplicate register CSV', () => {
  it('neutralizes spreadsheet formula injection', () => {
    const csv = duplicateRegisterToCsv([
      { tenantId: BUSINESS, accountId: 'a', code: '=cmd|/c calc', name: '+SUM(A1)', note: '@evil' },
    ]);
    const dataLine = csv.split('\n')[1];
    expect(dataLine).toContain("'=cmd|/c calc");
    expect(dataLine).toContain("'+SUM(A1)");
    expect(dataLine).toContain("'@evil");
  });

  it('escapes quotes and commas', () => {
    const csv = duplicateRegisterToCsv([
      { tenantId: BUSINESS, accountId: 'a', code: '5200', name: 'Salaries, "Wages"' },
    ]);
    expect(csv.split('\n')[1]).toContain('"Salaries, ""Wages"""');
  });
});
