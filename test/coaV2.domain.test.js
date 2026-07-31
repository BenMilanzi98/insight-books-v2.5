import { describe, it, expect } from 'vitest';
import {
  AccountCategory,
  AccountNormalBalance,
  AccountSubType,
  expectedNormalBalance,
  validateClassification,
  forbiddenClassificationError,
  categoryFromLegacyType,
} from '../lib/coaV2/domain/categories.js';
import {
  AccountBehaviour,
  AccountLifecycleStatus,
  AccountCurrencyPolicy,
  validateBehaviour,
  validateLifecycleTransition,
  accountAcceptsNewPostings,
  validateCurrencyPolicy,
  behaviourIsProtected,
} from '../lib/coaV2/domain/behaviours.js';
import {
  buildHierarchyIndex,
  getAncestors,
  getDescendants,
  getDepth,
  getHierarchyPath,
  wouldCreateCycle,
  findCycles,
  validateParentAssignment,
  deriveSubtreeBalance,
  buildAccountTree,
  DEFAULT_MAX_DEPTH,
} from '../lib/coaV2/domain/hierarchy.js';
import {
  APPROVED_CODE_ANCHORS,
  validateAccountCode,
  accountCodeSortKey,
  validateAccountCodeChange,
  nextAvailableCode,
  normalizeAccountCode,
} from '../lib/coaV2/domain/codeGovernance.js';
import {
  SystemAccountPurpose,
  ELEVATED_PURPOSES,
  isProtectedPurpose,
  validateAccountForPurpose,
  isSystemAccountPurpose,
} from '../lib/coaV2/domain/systemPurposes.js';
import {
  defaultFinancialStatementSection,
  validateFinancialStatementMapping,
  FinancialStatementSection,
} from '../lib/coaV2/domain/financialStatementMapping.js';
import {
  CashFlowClassification,
  defaultCashFlowClassification,
} from '../lib/coaV2/domain/cashFlowClassification.js';

/* ------------------------- categories & normal balance ------------------------- */

describe('account categories and normal balances', () => {
  it('applies default normal balances per category', () => {
    expect(expectedNormalBalance(AccountCategory.ASSET)).toBe(AccountNormalBalance.DEBIT);
    expect(expectedNormalBalance(AccountCategory.EXPENSE)).toBe(AccountNormalBalance.DEBIT);
    expect(expectedNormalBalance(AccountCategory.COST_OF_SALES)).toBe(AccountNormalBalance.DEBIT);
    expect(expectedNormalBalance(AccountCategory.LIABILITY)).toBe(AccountNormalBalance.CREDIT);
    expect(expectedNormalBalance(AccountCategory.EQUITY)).toBe(AccountNormalBalance.CREDIT);
    expect(expectedNormalBalance(AccountCategory.REVENUE)).toBe(AccountNormalBalance.CREDIT);
  });

  it('flips normal balance for contra subtypes', () => {
    expect(expectedNormalBalance(AccountCategory.ASSET, AccountSubType.CONTRA_ASSET))
      .toBe(AccountNormalBalance.CREDIT); // accumulated depreciation
    expect(expectedNormalBalance(AccountCategory.REVENUE, AccountSubType.CONTRA_REVENUE))
      .toBe(AccountNormalBalance.DEBIT); // sales returns
    expect(expectedNormalBalance(AccountCategory.EXPENSE, AccountSubType.CONTRA_EXPENSE))
      .toBe(AccountNormalBalance.CREDIT); // purchase returns
  });

  it('drawings and dividends are debit-normal equity', () => {
    expect(expectedNormalBalance(AccountCategory.EQUITY, AccountSubType.DRAWINGS))
      .toBe(AccountNormalBalance.DEBIT);
    expect(expectedNormalBalance(AccountCategory.EQUITY, AccountSubType.DIVIDENDS))
      .toBe(AccountNormalBalance.DEBIT);
  });

  it('rejects arbitrary normal-balance selection', () => {
    const result = validateClassification({
      category: AccountCategory.ASSET,
      subType: AccountSubType.CURRENT_ASSET,
      normalBalance: AccountNormalBalance.CREDIT,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/conflicts/);
  });

  it('rejects subtypes outside their category', () => {
    const result = validateClassification({
      category: AccountCategory.REVENUE,
      subType: AccountSubType.PAYROLL_EXPENSE,
    });
    expect(result.valid).toBe(false);
  });

  it('rejects unknown categories', () => {
    expect(validateClassification({ category: 'FUNKY' }).valid).toBe(false);
  });

  it('forbids owner capital classified as revenue', () => {
    expect(forbiddenClassificationError({
      category: AccountCategory.REVENUE,
      subType: AccountSubType.OWNER_CAPITAL,
    })).toMatch(/must not be classified as revenue/);
  });

  it('forbids drawings classified as operating expense', () => {
    expect(forbiddenClassificationError({
      category: AccountCategory.EXPENSE,
      subType: AccountSubType.DRAWINGS,
    })).toMatch(/must not be classified as operating expense/);
  });

  it('maps legacy types only when unambiguous', () => {
    expect(categoryFromLegacyType('Asset')).toBe(AccountCategory.ASSET);
    expect(categoryFromLegacyType('income')).toBe(AccountCategory.REVENUE);
    expect(categoryFromLegacyType('weird')).toBeNull();
    expect(categoryFromLegacyType(null)).toBeNull();
  });
});

/* ------------------------------- behaviours ------------------------------- */

describe('account behaviours', () => {
  it('header accounts cannot allow postings', () => {
    const result = validateBehaviour({ behaviour: AccountBehaviour.HEADER, postingAllowed: true });
    expect(result.valid).toBe(false);
  });

  it('posting accounts cannot have children unless the legacy exception is set', () => {
    expect(validateBehaviour({ behaviour: AccountBehaviour.POSTING, hasChildren: true }).valid).toBe(false);
    expect(validateBehaviour({
      behaviour: AccountBehaviour.POSTING,
      hasChildren: true,
      allowPostingWithChildren: true,
    }).valid).toBe(true);
  });

  it('control accounts reject manual postings', () => {
    const result = validateBehaviour({ behaviour: AccountBehaviour.CONTROL, manualPostingAllowed: true });
    expect(result.valid).toBe(false);
  });

  it('contra accounts must reference a consolidation group', () => {
    expect(validateBehaviour({ behaviour: AccountBehaviour.CONTRA }).valid).toBe(false);
    expect(validateBehaviour({ behaviour: AccountBehaviour.CONTRA, consolidationGroup: 'FIXED_ASSETS' }).valid).toBe(true);
  });

  it('marks SYSTEM and CONTROL as protected', () => {
    expect(behaviourIsProtected(AccountBehaviour.SYSTEM)).toBe(true);
    expect(behaviourIsProtected(AccountBehaviour.CONTROL)).toBe(true);
    expect(behaviourIsProtected(AccountBehaviour.POSTING)).toBe(false);
  });
});

describe('account lifecycle', () => {
  it('allows ACTIVE → DEPRECATED with a replacement when history exists', () => {
    const ok = validateLifecycleTransition({
      from: AccountLifecycleStatus.ACTIVE,
      to: AccountLifecycleStatus.DEPRECATED,
      hasActivePostingReferences: true,
      replacementAccountId: 'acc-2',
    });
    expect(ok.valid).toBe(true);
  });

  it('blocks deprecating a historically used account without a replacement', () => {
    const bad = validateLifecycleTransition({
      from: AccountLifecycleStatus.ACTIVE,
      to: AccountLifecycleStatus.DEPRECATED,
      hasActivePostingReferences: true,
      replacementAccountId: null,
    });
    expect(bad.valid).toBe(false);
    expect(bad.errors.join(' ')).toMatch(/replacement/);
  });

  it('blocks deprecating/archiving accounts holding an active system purpose', () => {
    const bad = validateLifecycleTransition({
      from: AccountLifecycleStatus.ACTIVE,
      to: AccountLifecycleStatus.ARCHIVED,
      isRequiredSystemAccount: true,
    });
    expect(bad.valid).toBe(false);
  });

  it('blocks ARCHIVED → DEPRECATED', () => {
    const bad = validateLifecycleTransition({
      from: AccountLifecycleStatus.ARCHIVED,
      to: AccountLifecycleStatus.DEPRECATED,
    });
    expect(bad.valid).toBe(false);
  });

  it('deprecated and archived accounts never accept new postings', () => {
    expect(accountAcceptsNewPostings({ status: AccountLifecycleStatus.DEPRECATED })).toBe(false);
    expect(accountAcceptsNewPostings({ status: AccountLifecycleStatus.ARCHIVED })).toBe(false);
    expect(accountAcceptsNewPostings({ behaviour: AccountBehaviour.HEADER })).toBe(false);
    expect(accountAcceptsNewPostings({ isActive: false })).toBe(false);
    expect(accountAcceptsNewPostings({
      behaviour: AccountBehaviour.POSTING,
      status: AccountLifecycleStatus.ACTIVE,
      postingAllowed: true,
      isActive: true,
    })).toBe(true);
  });
});

describe('currency policy', () => {
  it('SPECIFIC_CURRENCY requires an ISO currency configured for the business', () => {
    expect(validateCurrencyPolicy({
      currencyPolicy: AccountCurrencyPolicy.SPECIFIC_CURRENCY,
      specificCurrency: 'USD',
      businessCurrencies: ['MWK', 'USD'],
    }).valid).toBe(true);
    expect(validateCurrencyPolicy({
      currencyPolicy: AccountCurrencyPolicy.SPECIFIC_CURRENCY,
      specificCurrency: 'EUR',
      businessCurrencies: ['MWK'],
    }).valid).toBe(false);
    expect(validateCurrencyPolicy({
      currencyPolicy: AccountCurrencyPolicy.SPECIFIC_CURRENCY,
      specificCurrency: null,
    }).valid).toBe(false);
  });

  it('rejects specificCurrency with non-specific policies', () => {
    expect(validateCurrencyPolicy({
      currencyPolicy: AccountCurrencyPolicy.BASE_CURRENCY_ONLY,
      specificCurrency: 'USD',
    }).valid).toBe(false);
  });
});

/* ------------------------------- hierarchy ------------------------------- */

const T = 'tenant-1';
function makeChart() {
  return [
    { id: 'a1', tenantId: T, accountCode: '1000', parentAccountId: null, category: 'ASSET' },
    { id: 'a2', tenantId: T, accountCode: '1100', parentAccountId: 'a1', category: 'ASSET' },
    { id: 'a3', tenantId: T, accountCode: '1110', parentAccountId: 'a2', category: 'ASSET', balance: 100 },
    { id: 'a4', tenantId: T, accountCode: '1120', parentAccountId: 'a2', category: 'ASSET', balance: 50 },
    { id: 'e1', tenantId: T, accountCode: '5000', parentAccountId: null, category: 'EXPENSE' },
  ];
}

describe('hierarchy utilities', () => {
  it('computes ancestors, descendants, depth, and path', () => {
    const index = buildHierarchyIndex(makeChart());
    expect(getAncestors('a3', index).map((a) => a.id)).toEqual(['a2', 'a1']);
    expect(getDescendants('a1', index).map((a) => a.id).sort()).toEqual(['a2', 'a3', 'a4']);
    expect(getDepth('a3', index)).toBe(2);
    expect(getHierarchyPath('a3', index)).toBe('1000/1100/1110');
  });

  it('rejects self-parenting', () => {
    const result = validateParentAssignment({
      account: { id: 'a1', tenantId: T, category: 'ASSET' },
      parentAccountId: 'a1',
      businessAccounts: makeChart(),
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/own parent/);
  });

  it('rejects direct and indirect cycles', () => {
    const chart = makeChart();
    const index = buildHierarchyIndex(chart);
    expect(wouldCreateCycle('a2', 'a3', index)).toBe(true); // child of a2
    expect(wouldCreateCycle('a1', 'a4', index)).toBe(true); // grandchild
    expect(wouldCreateCycle('a4', 'a1', index)).toBe(false);

    const move = validateParentAssignment({
      account: { id: 'a1', tenantId: T, category: 'ASSET' },
      parentAccountId: 'a3',
      businessAccounts: chart,
    });
    expect(move.valid).toBe(false);
    expect(move.errors.join(' ')).toMatch(/circular/);
  });

  it('detects cycles stored in the database', () => {
    const broken = [
      { id: 'x1', parentAccountId: 'x2' },
      { id: 'x2', parentAccountId: 'x1' },
      { id: 'x3', parentAccountId: null },
    ];
    const cycles = findCycles(broken);
    expect(cycles.length).toBe(1);
    expect(cycles[0].sort()).toEqual(['x1', 'x2']);
  });

  it('rejects cross-business parents', () => {
    const result = validateParentAssignment({
      account: { id: 'z9', tenantId: 'tenant-2', category: 'ASSET' },
      parentAccountId: 'a1',
      businessAccounts: makeChart(),
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/different business/);
  });

  it('rejects incompatible category parents', () => {
    const result = validateParentAssignment({
      account: { id: 'n1', tenantId: T, category: 'EXPENSE' },
      parentAccountId: 'a2',
      businessAccounts: makeChart(),
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/incompatible/);
  });

  it('enforces maximum depth', () => {
    const deep = [{ id: 'd0', tenantId: T, accountCode: '1000', parentAccountId: null, category: 'ASSET' }];
    for (let i = 1; i <= DEFAULT_MAX_DEPTH; i += 1) {
      deep.push({ id: `d${i}`, tenantId: T, accountCode: `10${i}0`, parentAccountId: `d${i - 1}`, category: 'ASSET' });
    }
    const result = validateParentAssignment({
      account: { id: 'new', tenantId: T, category: 'ASSET' },
      parentAccountId: `d${DEFAULT_MAX_DEPTH}`,
      businessAccounts: deep,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/depth/);
  });

  it('warns when moving an account with historical activity', () => {
    const result = validateParentAssignment({
      account: { id: 'a4', tenantId: T, category: 'ASSET', hasActivity: true },
      parentAccountId: 'a1',
      businessAccounts: makeChart(),
    });
    expect(result.valid).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/impact analysis/);
  });

  it('derives parent totals from descendants only (no double count)', () => {
    const chart = makeChart();
    // Parent a2 has a STORED balance that must be ignored (CAP-002 pattern).
    chart.find((a) => a.id === 'a2').balance = 999;
    const index = buildHierarchyIndex(chart);
    const total = deriveSubtreeBalance('a2', index, (a) => a.balance ?? 0);
    expect(total).toBe(150); // 100 + 50, never + 999
    expect(deriveSubtreeBalance('a1', index, (a) => a.balance ?? 0)).toBe(150);
  });

  it('builds a deterministic tree with orphans as roots', () => {
    const chart = [...makeChart(), { id: 'orphan', tenantId: T, accountCode: '9999', parentAccountId: 'missing' }];
    const tree = buildAccountTree(chart);
    const rootCodes = tree.map((n) => n.account.accountCode);
    expect(rootCodes).toEqual(['1000', '5000', '9999']);
    const assets = tree[0];
    expect(assets.children[0].account.accountCode).toBe('1100');
    expect(assets.children[0].children.map((c) => c.account.accountCode)).toEqual(['1110', '1120']);
  });
});

/* ---------------------------- code governance ---------------------------- */

describe('account code governance', () => {
  it('preserves the approved anchors', () => {
    expect(APPROVED_CODE_ANCHORS.EXPENSES_HEADER).toBe('5000');
    expect(APPROVED_CODE_ANCHORS.SALARIES_AND_WAGES).toBe('5200');
  });

  it('validates permitted formats', () => {
    expect(validateAccountCode({ code: '1110' }).valid).toBe(true);
    expect(validateAccountCode({ code: '1131-01' }).valid).toBe(true);
    expect(validateAccountCode({ code: ' 1110 ' }).normalized).toBe('1110');
    expect(validateAccountCode({ code: '12' }).valid).toBe(false);
    expect(validateAccountCode({ code: 'ABCD' }).valid).toBe(false);
    expect(validateAccountCode({ code: '' }).valid).toBe(false);
  });

  it('warns (not errors) on out-of-range codes for a category', () => {
    const result = validateAccountCode({ code: '9000', category: 'ASSET' });
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBe(1);
  });

  it('sorts hierarchical codes deterministically', () => {
    const codes = ['1131-02', '1131', '1132', '1131-01'];
    const sorted = [...codes].sort((a, b) => accountCodeSortKey(a).localeCompare(accountCodeSortKey(b)));
    expect(sorted).toEqual(['1131', '1131-01', '1131-02', '1132']);
  });

  it('blocks changing approved anchor codes', () => {
    const result = validateAccountCodeChange({
      currentCode: '5200',
      newCode: '5299',
      hasHistoricalActivity: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.errors.join(' ')).toMatch(/anchor/);
  });

  it('requires the controlled process for historically used codes', () => {
    const bare = validateAccountCodeChange({
      currentCode: '5310',
      newCode: '5311',
      hasHistoricalActivity: true,
    });
    expect(bare.allowed).toBe(false);
    expect(bare.errors.length).toBeGreaterThanOrEqual(4);

    const controlled = validateAccountCodeChange({
      currentCode: '5310',
      newCode: '5311',
      hasHistoricalActivity: true,
      controlled: {
        authorized: true,
        reason: 'Approved renumbering',
        impactAnalysisDone: true,
        aliasWillBeCreated: true,
      },
    });
    expect(controlled.allowed).toBe(true);
  });

  it('finds the next available code in a range', () => {
    expect(nextAvailableCode(['5700', '5710'], { from: 5700, to: 5790 })).toBe('5720');
    expect(nextAvailableCode([], { from: 5700, to: 5790 })).toBe('5700');
    const full = Array.from({ length: 91 }, (_, i) => String(5700 + i));
    expect(nextAvailableCode(full, { from: 5700, to: 5790 })).toBeNull();
  });

  it('normalizes codes', () => {
    expect(normalizeAccountCode(' 1131-01 ')).toBe('1131-01');
    expect(normalizeAccountCode(null)).toBeNull();
  });
});

/* ---------------------------- system purposes ---------------------------- */

describe('system account purposes', () => {
  it('exposes the required purpose catalogue', () => {
    for (const key of [
      'CASH_ON_HAND', 'ACCOUNTS_RECEIVABLE', 'ACCOUNTS_PAYABLE', 'INVENTORY',
      'SALES_REVENUE', 'COST_OF_SALES', 'SALARIES_AND_WAGES', 'RETAINED_EARNINGS',
      'CURRENT_YEAR_EARNINGS', 'OWNER_DRAWINGS', 'ACCUMULATED_DEPRECIATION',
      'VAT_OUTPUT', 'PAYE_PAYABLE', 'SUSPENSE_ACCOUNT', 'OPENING_BALANCE_EQUITY',
    ]) {
      expect(isSystemAccountPurpose(key)).toBe(true);
    }
    expect(isSystemAccountPurpose('NOT_A_PURPOSE')).toBe(false);
  });

  it('protects retained earnings and control purposes', () => {
    expect(isProtectedPurpose(SystemAccountPurpose.RETAINED_EARNINGS)).toBe(true);
    expect(ELEVATED_PURPOSES).toContain('RETAINED_EARNINGS');
    expect(ELEVATED_PURPOSES).toContain('SUSPENSE_ACCOUNT');
  });

  it('accepts a valid ACCOUNTS_RECEIVABLE control mapping', () => {
    const result = validateAccountForPurpose('ACCOUNTS_RECEIVABLE', {
      tenantId: T, category: 'ASSET', subType: 'CURRENT_ASSET',
      behaviour: 'CONTROL', normalBalance: 'DEBIT', status: 'ACTIVE', isActive: true,
    }, { businessId: T });
    expect(result.valid).toBe(true);
  });

  it('rejects wrong category for a purpose', () => {
    const result = validateAccountForPurpose('SALES_REVENUE', {
      tenantId: T, category: 'EQUITY', behaviour: 'POSTING',
      normalBalance: 'CREDIT', status: 'ACTIVE', isActive: true,
    }, { businessId: T });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/requires category/);
  });

  it('rejects salaries purpose resolving to a liability', () => {
    const result = validateAccountForPurpose('SALARIES_AND_WAGES', {
      tenantId: T, category: 'LIABILITY', behaviour: 'POSTING',
      normalBalance: 'CREDIT', status: 'ACTIVE', isActive: true,
    }, { businessId: T });
    expect(result.valid).toBe(false);
  });

  it('rejects cross-business, deprecated, header, and unclassified accounts', () => {
    const crossTenant = validateAccountForPurpose('INVENTORY', {
      tenantId: 'other', category: 'ASSET', behaviour: 'POSTING',
      normalBalance: 'DEBIT', status: 'ACTIVE', isActive: true,
    }, { businessId: T });
    expect(crossTenant.valid).toBe(false);

    const deprecated = validateAccountForPurpose('INVENTORY', {
      tenantId: T, category: 'ASSET', behaviour: 'POSTING',
      normalBalance: 'DEBIT', status: 'DEPRECATED', isActive: true,
    }, { businessId: T });
    expect(deprecated.valid).toBe(false);

    const header = validateAccountForPurpose('INVENTORY', {
      tenantId: T, category: 'ASSET', behaviour: 'POSTING',
      normalBalance: 'DEBIT', status: 'ACTIVE', isActive: true, hasActiveChildren: true,
    }, { businessId: T });
    expect(header.valid).toBe(false);

    const unclassified = validateAccountForPurpose('INVENTORY', {
      tenantId: T, category: null, behaviour: null,
      normalBalance: null, status: 'ACTIVE', isActive: true,
    }, { businessId: T });
    expect(unclassified.valid).toBe(false);
  });

  it('requires contra behaviour + credit balance for accumulated depreciation', () => {
    const good = validateAccountForPurpose('ACCUMULATED_DEPRECIATION', {
      tenantId: T, category: 'ASSET', subType: 'CONTRA_ASSET',
      behaviour: 'CONTRA', normalBalance: 'CREDIT', status: 'ACTIVE', isActive: true,
    }, { businessId: T });
    expect(good.valid).toBe(true);

    const wrongBalance = validateAccountForPurpose('ACCUMULATED_DEPRECIATION', {
      tenantId: T, category: 'ASSET', subType: 'CONTRA_ASSET',
      behaviour: 'CONTRA', normalBalance: 'DEBIT', status: 'ACTIVE', isActive: true,
    }, { businessId: T });
    expect(wrongBalance.valid).toBe(false);
  });
});

/* -------------------- financial statement & cash flow -------------------- */

describe('financial statement mapping', () => {
  it('maps categories to default sections', () => {
    expect(defaultFinancialStatementSection('REVENUE'))
      .toBe(FinancialStatementSection.REVENUE);
    expect(defaultFinancialStatementSection('ASSET', 'CURRENT_ASSET'))
      .toBe(FinancialStatementSection.CURRENT_ASSETS);
    expect(defaultFinancialStatementSection('ASSET', 'NON_CURRENT_ASSET'))
      .toBe(FinancialStatementSection.NON_CURRENT_ASSETS);
  });

  it('rejects equity accounts mapped into revenue sections', () => {
    const result = validateFinancialStatementMapping({
      category: 'EQUITY',
      section: FinancialStatementSection.REVENUE,
    });
    expect(result.valid).toBe(false);
  });

  it('accepts compatible mappings', () => {
    const result = validateFinancialStatementMapping({
      category: 'EXPENSE',
      section: FinancialStatementSection.OPERATING_EXPENSES,
    });
    expect(result.valid).toBe(true);
  });
});

describe('cash flow classification', () => {
  it('classifies cash and bank as cash equivalents', () => {
    expect(defaultCashFlowClassification({ systemPurpose: 'CASH_ON_HAND' }))
      .toBe(CashFlowClassification.CASH_AND_CASH_EQUIVALENT);
    expect(defaultCashFlowClassification({ systemPurpose: 'PRIMARY_BANK' }))
      .toBe(CashFlowClassification.CASH_AND_CASH_EQUIVALENT);
  });

  it('classifies loans and capital as financing', () => {
    expect(defaultCashFlowClassification({ systemPurpose: 'LOAN_LIABILITY' }))
      .toBe(CashFlowClassification.FINANCING);
    expect(defaultCashFlowClassification({ systemPurpose: 'OWNER_CAPITAL' }))
      .toBe(CashFlowClassification.FINANCING);
  });

  it('classifies depreciation as non-cash and fixed assets as investing', () => {
    expect(defaultCashFlowClassification({ systemPurpose: 'DEPRECIATION_EXPENSE' }))
      .toBe(CashFlowClassification.NON_CASH);
    expect(defaultCashFlowClassification({ systemPurpose: 'FIXED_ASSET' }))
      .toBe(CashFlowClassification.INVESTING);
  });

  it('classifies operating expenses as operating', () => {
    expect(defaultCashFlowClassification({ category: 'EXPENSE' }))
      .toBe(CashFlowClassification.OPERATING);
  });
});
