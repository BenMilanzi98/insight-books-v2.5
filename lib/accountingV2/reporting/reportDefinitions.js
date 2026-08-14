/**
 * Phase 7 — versioned report definitions and explicit line mapping.
 *
 * Definitions are immutable published templates (scope: TEMPLATE, usable by
 * every business; business-scoped overrides are additive future work). Lines
 * map to accounts through DECLARATIVE match rules evaluated against the
 * account's Phase 3 classification (coaV2Category / coaV2SubType /
 * financialStatementSection / cashFlowClassification / systemPurpose /
 * controlAccountPurpose). Account-code or name heuristics are ASSIST-level
 * fallbacks for unclassified legacy accounts only and always carry a mapping
 * warning. Computed lines use controlled formulas (line references with +/−),
 * never executable code.
 */

import { AccountingValidationError } from '../domain/errors.js';

/* ── Account profile resolution ──────────────────────────────────────────── */

const LEGACY_TYPE_CATEGORY = Object.freeze({
  asset: 'ASSET',
  liability: 'LIABILITY',
  equity: 'EQUITY',
  income: 'REVENUE',
  revenue: 'REVENUE',
  expense: 'EXPENSE',
});

const P_AND_L_CATEGORIES = Object.freeze([
  'REVENUE',
  'OTHER_INCOME',
  'COST_OF_SALES',
  'EXPENSE',
  'OTHER_EXPENSE',
]);

const nameHas = (account, words) => {
  const hay = `${account.accountName ?? ''} ${account.accountCode ?? ''}`.toLowerCase();
  return words.some((w) => hay.includes(w));
};

/**
 * Resolve a reporting profile for one account row. `classificationSource`
 * records whether the profile came from explicit Phase 3 classification or an
 * assist heuristic (the latter produces REP-036-adjacent warnings upstream).
 * @param {object} account ledger summary row or Account row
 */
export function resolveAccountProfile(account) {
  const explicitCategory = String(account.category ?? account.coaV2Category ?? '').toUpperCase() || null;
  const legacyType = String(account.accountType ?? account.type ?? '').toLowerCase();
  let category = explicitCategory || LEGACY_TYPE_CATEGORY[legacyType] || null;

  const code = String(account.accountCode ?? account.code ?? '').trim();
  const codeNum = parseInt(code.replace(/-\d+$/, ''), 10);
  // Blueprint 5100–5199 is Cost of Goods — never treat as operating expense on P&L.
  if (!Number.isNaN(codeNum) && codeNum >= 5100 && codeNum <= 5199) {
    category = 'COST_OF_SALES';
  }
  const subtypeName = String(account.accountSubtype ?? account.subtype ?? '').toLowerCase();
  if (
    subtypeName.includes('cost of sales') ||
    subtypeName.includes('cost of goods') ||
    /cogs|cost of goods sold/i.test(String(account.accountName ?? account.name ?? ''))
  ) {
    if (category === 'EXPENSE' || !category) category = 'COST_OF_SALES';
  }

  let subType = String(account.coaV2SubType ?? '').toUpperCase() || null;
  // Blueprint 5580 Corporate Tax Expense must map to the CIT line, not OpEx.
  if (
    code === '5580' ||
    nameHas(account, ['corporate tax expense', 'income tax expense', 'corporate income tax expense'])
  ) {
    subType = 'TAX_EXPENSE';
  }
  const section = String(account.financialStatementSection ?? '').toUpperCase() || null;
  const subsection = String(account.financialStatementSubsection ?? '').toUpperCase() || null;
  const cashFlow = String(account.cashFlowClassification ?? '').toUpperCase() || null;
  const purpose = String(account.systemPurpose ?? '').toUpperCase() || null;
  const controlPurpose = String(account.controlAccountPurpose ?? '').toUpperCase() || null;

  // Assist heuristics — only consulted when explicit classification is absent.
  const assist = {
    cash: nameHas(account, ['cash', 'bank', 'mobile money', 'mpamba', 'airtel money', 'petty']),
    receivable: nameHas(account, ['receivable', 'debtors']),
    payable: nameHas(account, ['payable', 'creditors']),
    inventory: nameHas(account, ['inventory', 'stock']),
    fixedAsset: nameHas(account, ['equipment', 'vehicle', 'property', 'furniture', 'machinery', 'fixed asset', 'building', 'land']),
    accumulatedDepreciation: nameHas(account, ['accumulated depreciation']),
    depreciation: nameHas(account, ['depreciation', 'amortization', 'amortisation']),
    interest: nameHas(account, ['interest', 'finance cost', 'finance charge', 'bank charge']),
    taxExpense: nameHas(account, [
      'tax expense',
      'corporate tax',
      'income tax expense',
      'corporate income tax expense',
      'corporate tax expense',
    ]),
    taxLiability: nameHas(account, ['vat', 'paye', 'withholding', 'tax payable']),
    loan: nameHas(account, ['loan', 'borrow']),
    payrollLiability: nameHas(account, ['salaries payable', 'payroll payable', 'pension payable', 'paye payable', 'wages payable']),
    capital: nameHas(account, ['capital', 'share']),
    drawings: nameHas(account, ['drawing']),
    retainedEarnings: nameHas(account, ['retained earnings']),
    prepayment: nameHas(account, ['prepaid', 'prepayment']),
    salaries: nameHas(account, ['salar', 'wage', 'payroll']),
  };

  const isCash =
    purpose === 'CASH' ||
    purpose === 'BANK' ||
    purpose === 'MOBILE_MONEY' ||
    controlPurpose === 'CASH_AND_BANK' ||
    cashFlow === 'CASH_AND_CASH_EQUIVALENTS' ||
    subType === 'CASH_AND_BANK' ||
    subType === 'CASH' ||
    subType === 'BANK' ||
    (category === 'ASSET' && !subType && !purpose && assist.cash);

  const explicit = Boolean(explicitCategory || subType || section || purpose || cashFlow);
  return {
    accountId: account.accountId ?? account.id,
    category,
    subType,
    section,
    subsection,
    cashFlow,
    purpose,
    controlPurpose,
    isPnl: P_AND_L_CATEGORIES.includes(category),
    isCash,
    assist,
    classificationSource: explicit ? 'EXPLICIT' : category ? 'LEGACY_TYPE' : 'UNCLASSIFIED',
  };
}

/* ── Match rule evaluation (declarative, no code execution) ──────────────── */

/**
 * @param {object} profile from resolveAccountProfile
 * @param {object} rule declarative matcher
 */
export function accountMatchesRule(profile, rule, row = null) {
  if (!rule) return false;
  const code = String(row?.accountCode ?? row?.code ?? profile?.accountCode ?? '').trim();

  if (rule.codes?.length && !rule.codes.includes(code)) return false;
  if (rule.codePrefixes?.length && !rule.codePrefixes.some((p) => code.startsWith(String(p)))) {
    return false;
  }
  if (rule.excludeCodes?.includes(code)) return false;
  if (rule.excludeCodePrefixes?.some((p) => code.startsWith(String(p)))) return false;

  if (rule.categories && !rule.categories.includes(profile.category)) return false;
  if (rule.excludeSubTypes && rule.excludeSubTypes.includes(profile.subType)) return false;
  if (rule.isCash != null && rule.isCash !== profile.isCash) return false;
  if (rule.subTypes || rule.purposes || rule.sections || rule.assistAny) {
    const bySubType = rule.subTypes?.includes(profile.subType);
    const byPurpose =
      rule.purposes?.some((p) => profile.purpose === p || profile.controlPurpose === p);
    const bySection = rule.sections?.some(
      (s) => profile.section === s || profile.subsection === s
    );
    const byAssist =
      rule.assistAny && rule.assistAny.some((key) => profile.assist[key]) &&
      // assist applies only when no explicit sub-classification contradicts it
      !profile.subType;
    if (!(bySubType || byPurpose || bySection || byAssist)) return false;
  }
  if (rule.excludeAssist && !profile.subType && rule.excludeAssist.some((k) => profile.assist[k])) {
    return false;
  }
  return true;
}

/* ── Definition catalogue ─────────────────────────────────────────────────── */

const line = (o) => Object.freeze(o);

/** Income Statement v1.0.0 — period-activity statement (§21–23). */
const INCOME_STATEMENT_V1 = Object.freeze({
  id: 'IS-STANDARD',
  reportType: 'INCOME_STATEMENT',
  name: 'Income Statement',
  version: '1.0.0',
  scope: 'TEMPLATE',
  status: 'PUBLISHED',
  basis: 'PERIOD_ACTIVITY',
  lines: [
    line({ lineId: 'revenue', label: 'Revenue', lineType: 'ACCOUNT_GROUP', displaySign: -1, displayOrder: 10, match: { categories: ['REVENUE'] } }),
    line({ lineId: 'cost-of-sales', label: 'Cost of Goods', lineType: 'ACCOUNT_GROUP', displaySign: 1, displayOrder: 20, match: { categories: ['COST_OF_SALES'] } }),
    line({ lineId: 'gross-profit', label: 'Gross Profit', lineType: 'CALCULATED_TOTAL', displayOrder: 30, formula: [{ op: '+', ref: 'revenue' }, { op: '-', ref: 'cost-of-sales' }] }),
    line({
      lineId: 'operating-expenses', label: 'Operating Expenses', lineType: 'ACCOUNT_GROUP', displaySign: 1, displayOrder: 40,
      match: {
        categories: ['EXPENSE'],
        excludeSubTypes: [
          'DEPRECIATION',
          'AMORTIZATION',
          'FINANCE_COST',
          'INTEREST',
          'TAX',
          'INCOME_TAX',
          'TAX_EXPENSE',
          'INVENTORY_COST',
        ],
        excludeAssist: ['depreciation', 'interest', 'taxExpense'],
        excludeCodePrefixes: ['511', '512', '513', '514', '515', '516', '517', '518'],
        excludeCodes: ['5100', '5110', '5580'],
      },
    }),
    line({ lineId: 'ebitda', label: 'EBITDA', lineType: 'CALCULATED_TOTAL', displayOrder: 50, formula: [{ op: '+', ref: 'gross-profit' }, { op: '-', ref: 'operating-expenses' }] }),
    line({
      lineId: 'depreciation-amortization', label: 'Depreciation and Amortization', lineType: 'ACCOUNT_GROUP', displaySign: 1, displayOrder: 60,
      match: { categories: ['EXPENSE'], subTypes: ['DEPRECIATION', 'AMORTIZATION'], assistAny: ['depreciation'] },
    }),
    line({ lineId: 'operating-profit', label: 'Operating Profit', lineType: 'CALCULATED_TOTAL', displayOrder: 70, formula: [{ op: '+', ref: 'ebitda' }, { op: '-', ref: 'depreciation-amortization' }] }),
    line({ lineId: 'other-income', label: 'Other Income', lineType: 'ACCOUNT_GROUP', displaySign: -1, displayOrder: 80, match: { categories: ['OTHER_INCOME'] } }),
    line({ lineId: 'other-expenses', label: 'Other Expenses', lineType: 'ACCOUNT_GROUP', displaySign: 1, displayOrder: 90, match: { categories: ['OTHER_EXPENSE'], excludeSubTypes: ['FINANCE_COST', 'INTEREST', 'TAX'], excludeAssist: ['interest', 'taxExpense'] } }),
    line({
      lineId: 'finance-costs', label: 'Finance Costs', lineType: 'ACCOUNT_GROUP', displaySign: 1, displayOrder: 100,
      match: { categories: ['EXPENSE', 'OTHER_EXPENSE'], subTypes: ['FINANCE_COST', 'INTEREST'], assistAny: ['interest'] },
    }),
    line({ lineId: 'profit-before-tax', label: 'Net Profit Before Tax', lineType: 'CALCULATED_TOTAL', displayOrder: 110, formula: [{ op: '+', ref: 'operating-profit' }, { op: '+', ref: 'other-income' }, { op: '-', ref: 'other-expenses' }, { op: '-', ref: 'finance-costs' }] }),
    line({
      lineId: 'tax-expense', label: 'Corporate Income Tax', lineType: 'ACCOUNT_GROUP', displaySign: 1, displayOrder: 120,
      match: {
        categories: ['EXPENSE', 'OTHER_EXPENSE'],
        subTypes: ['TAX', 'INCOME_TAX', 'TAX_EXPENSE'],
        assistAny: ['taxExpense'],
      },
    }),
    line({ lineId: 'net-profit', label: 'Net Profit After Tax', lineType: 'GRAND_TOTAL', displayOrder: 130, formula: [{ op: '+', ref: 'profit-before-tax' }, { op: '-', ref: 'tax-expense' }] }),
  ],
});

/** Balance Sheet v1.0.0 — cumulative as-of statement (§24–28). */
const BALANCE_SHEET_V1 = Object.freeze({
  id: 'BS-STANDARD',
  reportType: 'BALANCE_SHEET',
  name: 'Statement of Financial Position',
  version: '1.0.0',
  scope: 'TEMPLATE',
  status: 'PUBLISHED',
  basis: 'AS_OF_CUMULATIVE',
  lines: [
    line({ lineId: 'assets', label: 'ASSETS', lineType: 'SECTION', displayOrder: 10 }),
    line({ lineId: 'cash', label: 'Cash and Cash Equivalents', lineType: 'ACCOUNT_GROUP', parentLineId: 'assets', displaySign: 1, displayOrder: 11, match: { categories: ['ASSET'], isCash: true } }),
    line({ lineId: 'accounts-receivable', label: 'Accounts Receivable', lineType: 'ACCOUNT_GROUP', parentLineId: 'assets', displaySign: 1, displayOrder: 12, match: { categories: ['ASSET'], subTypes: ['ACCOUNTS_RECEIVABLE', 'RECEIVABLE'], purposes: ['ACCOUNTS_RECEIVABLE'], assistAny: ['receivable'] } }),
    line({ lineId: 'inventory', label: 'Inventory', lineType: 'ACCOUNT_GROUP', parentLineId: 'assets', displaySign: 1, displayOrder: 13, match: { categories: ['ASSET'], subTypes: ['INVENTORY'], purposes: ['INVENTORY'], assistAny: ['inventory'] } }),
    line({ lineId: 'prepayments', label: 'Prepayments', lineType: 'ACCOUNT_GROUP', parentLineId: 'assets', displaySign: 1, displayOrder: 14, match: { categories: ['ASSET'], subTypes: ['PREPAYMENT'], assistAny: ['prepayment'] } }),
    line({ lineId: 'accumulated-depreciation', label: 'Less: Accumulated Depreciation', lineType: 'ACCOUNT_GROUP', parentLineId: 'assets', displaySign: 1, displayOrder: 16, match: { categories: ['ASSET'], subTypes: ['ACCUMULATED_DEPRECIATION', 'CONTRA_ASSET'], assistAny: ['accumulatedDepreciation'] } }),
    line({ lineId: 'fixed-assets', label: 'Property, Plant and Equipment', lineType: 'ACCOUNT_GROUP', parentLineId: 'assets', displaySign: 1, displayOrder: 15, match: { categories: ['ASSET'], subTypes: ['FIXED_ASSET', 'PROPERTY_PLANT_EQUIPMENT', 'PPE', 'NON_CURRENT_ASSET', 'INTANGIBLE', 'INVESTMENT'], sections: ['NON_CURRENT_ASSETS'], assistAny: ['fixedAsset'] } }),
    line({ lineId: 'other-assets', label: 'Other Assets', lineType: 'ACCOUNT_GROUP', parentLineId: 'assets', displaySign: 1, displayOrder: 17, match: { categories: ['ASSET'] } }),
    line({ lineId: 'total-assets', label: 'TOTAL ASSETS', lineType: 'GRAND_TOTAL', displayOrder: 19, formula: [{ op: '+', ref: 'cash' }, { op: '+', ref: 'accounts-receivable' }, { op: '+', ref: 'inventory' }, { op: '+', ref: 'prepayments' }, { op: '+', ref: 'fixed-assets' }, { op: '+', ref: 'accumulated-depreciation' }, { op: '+', ref: 'other-assets' }] }),
    line({ lineId: 'liabilities', label: 'LIABILITIES', lineType: 'SECTION', displayOrder: 20 }),
    line({ lineId: 'accounts-payable', label: 'Accounts Payable', lineType: 'ACCOUNT_GROUP', parentLineId: 'liabilities', displaySign: -1, displayOrder: 21, match: { categories: ['LIABILITY'], subTypes: ['ACCOUNTS_PAYABLE', 'PAYABLE'], purposes: ['ACCOUNTS_PAYABLE'], assistAny: ['payable'] } }),
    line({ lineId: 'taxes-payable', label: 'Taxes Payable', lineType: 'ACCOUNT_GROUP', parentLineId: 'liabilities', displaySign: -1, displayOrder: 22, match: { categories: ['LIABILITY'], subTypes: ['TAX_LIABILITY', 'VAT', 'PAYE', 'WITHHOLDING_TAX'], purposes: ['VAT_PAYABLE', 'PAYE_PAYABLE', 'TAX'], assistAny: ['taxLiability'] } }),
    line({ lineId: 'payroll-liabilities', label: 'Payroll Liabilities', lineType: 'ACCOUNT_GROUP', parentLineId: 'liabilities', displaySign: -1, displayOrder: 23, match: { categories: ['LIABILITY'], subTypes: ['PAYROLL_LIABILITY', 'PENSION_PAYABLE'], purposes: ['PAYROLL_PAYABLE', 'PENSION_PAYABLE'], assistAny: ['payrollLiability'] } }),
    line({ lineId: 'loans', label: 'Loans and Borrowings', lineType: 'ACCOUNT_GROUP', parentLineId: 'liabilities', displaySign: -1, displayOrder: 24, match: { categories: ['LIABILITY'], subTypes: ['LOAN', 'LONG_TERM_LOAN', 'CURRENT_LOAN', 'BORROWING', 'LEASE_LIABILITY'], purposes: ['LOAN_PAYABLE'], assistAny: ['loan'] } }),
    line({ lineId: 'other-liabilities', label: 'Other Liabilities', lineType: 'ACCOUNT_GROUP', parentLineId: 'liabilities', displaySign: -1, displayOrder: 25, match: { categories: ['LIABILITY'] } }),
    line({ lineId: 'total-liabilities', label: 'TOTAL LIABILITIES', lineType: 'GRAND_TOTAL', displayOrder: 29, formula: [{ op: '+', ref: 'accounts-payable' }, { op: '+', ref: 'taxes-payable' }, { op: '+', ref: 'payroll-liabilities' }, { op: '+', ref: 'loans' }, { op: '+', ref: 'other-liabilities' }] }),
    line({ lineId: 'equity', label: 'EQUITY', lineType: 'SECTION', displayOrder: 30 }),
    line({ lineId: 'owner-capital', label: 'Owner Capital and Contributions', lineType: 'ACCOUNT_GROUP', parentLineId: 'equity', displaySign: -1, displayOrder: 31, match: { categories: ['EQUITY'], subTypes: ['OWNER_CAPITAL', 'SHARE_CAPITAL', 'CAPITAL_CONTRIBUTION', 'SHARE_PREMIUM'], purposes: ['OWNER_CAPITAL'], assistAny: ['capital'], excludeSubTypes: ['RETAINED_EARNINGS', 'DRAWINGS'], excludeAssist: ['drawings', 'retainedEarnings'] } }),
    line({ lineId: 'drawings', label: 'Less: Owner Drawings', lineType: 'ACCOUNT_GROUP', parentLineId: 'equity', displaySign: -1, displayOrder: 32, match: { categories: ['EQUITY'], subTypes: ['DRAWINGS'], assistAny: ['drawings'] } }),
    line({ lineId: 'other-equity', label: 'Other Equity and Reserves', lineType: 'ACCOUNT_GROUP', parentLineId: 'equity', displaySign: -1, displayOrder: 33, match: { categories: ['EQUITY'], excludeSubTypes: ['RETAINED_EARNINGS'], excludeAssist: ['retainedEarnings'] } }),
    line({ lineId: 'retained-earnings-posted', label: 'Retained Earnings (posted)', lineType: 'ACCOUNT_GROUP', parentLineId: 'equity', displaySign: -1, displayOrder: 34, match: { categories: ['EQUITY'], subTypes: ['RETAINED_EARNINGS'], assistAny: ['retainedEarnings'] } }),
    // Computed from P&L accounts (method A, §27): never typed, never stored.
    line({ lineId: 'retained-earnings-calculated', label: 'Retained Earnings (accumulated prior years)', lineType: 'CALCULATED_TOTAL', parentLineId: 'equity', displayOrder: 35, computed: 'RETAINED_EARNINGS' }),
    line({ lineId: 'current-year-earnings', label: 'Current Year Earnings', lineType: 'CALCULATED_TOTAL', parentLineId: 'equity', displayOrder: 36, computed: 'CURRENT_YEAR_EARNINGS' }),
    line({ lineId: 'total-equity', label: 'TOTAL EQUITY', lineType: 'GRAND_TOTAL', displayOrder: 39, formula: [{ op: '+', ref: 'owner-capital' }, { op: '+', ref: 'drawings' }, { op: '+', ref: 'other-equity' }, { op: '+', ref: 'retained-earnings-posted' }, { op: '+', ref: 'retained-earnings-calculated' }, { op: '+', ref: 'current-year-earnings' }] }),
    line({ lineId: 'total-liabilities-equity', label: 'TOTAL LIABILITIES AND EQUITY', lineType: 'GRAND_TOTAL', displayOrder: 40, formula: [{ op: '+', ref: 'total-liabilities' }, { op: '+', ref: 'total-equity' }] }),
  ],
});

/** Cash Flow v1.0.0 — indirect method (default approved method, §29–32). */
const CASH_FLOW_V1 = Object.freeze({
  id: 'CF-INDIRECT',
  reportType: 'CASH_FLOW',
  name: 'Cash Flow Statement (indirect method)',
  version: '1.0.0',
  scope: 'TEMPLATE',
  status: 'PUBLISHED',
  basis: 'PERIOD_ACTIVITY',
  method: 'INDIRECT',
  lines: [], // built dynamically from GL classification in financialStatementService
});

/** Statement of Changes in Equity v1.0.0 (§33). */
const EQUITY_STATEMENT_V1 = Object.freeze({
  id: 'EQ-CHANGES',
  reportType: 'EQUITY_STATEMENT',
  name: 'Statement of Changes in Equity',
  version: '1.0.0',
  scope: 'TEMPLATE',
  status: 'PUBLISHED',
  basis: 'PERIOD_ACTIVITY',
  lines: [],
});

const DEFINITIONS = Object.freeze({
  INCOME_STATEMENT: { '1.0.0': INCOME_STATEMENT_V1 },
  BALANCE_SHEET: { '1.0.0': BALANCE_SHEET_V1 },
  CASH_FLOW: { '1.0.0': CASH_FLOW_V1 },
  EQUITY_STATEMENT: { '1.0.0': EQUITY_STATEMENT_V1 },
});

/**
 * Resolve a published, immutable report definition. Historical report runs
 * store the version they used; regeneration with the same version is exact.
 * @param {string} reportType
 * @param {string} [version] defaults to latest published
 */
export function getReportDefinition(reportType, version = null) {
  const versions = DEFINITIONS[reportType];
  if (!versions) {
    throw new AccountingValidationError(`No report definition for type ${reportType}.`);
  }
  const resolved = version ?? Object.keys(versions).sort().at(-1);
  const definition = versions[resolved];
  if (!definition) {
    throw new AccountingValidationError(
      `Report definition version ${resolved} not found for ${reportType}.`
    );
  }
  return definition;
}

/**
 * R4-A: amounts come from posting accounts and exceptional headers (direct
 * historical activity on a non-posting parent). Clean headers never contribute.
 * @param {object} row ledger summary row
 */
export function isAmountBearingAccount(row) {
  return !row?.isHeader || Boolean(row?.exceptionalPostingAccount);
}

/**
 * Assign posting accounts to definition lines deterministically: definition
 * order, first match wins, one account contributes to exactly one
 * ACCOUNT_GROUP line (REP-013/REP-037 by construction). Clean header accounts
 * are excluded (presentation only). Exceptional headers with direct posted
 * activity are included once (GL-110 / REP-041). Merged-away accounts are
 * already rolled up by the ledger query service.
 *
 * @param {object} definition
 * @param {Array<object>} accountRows ledger summary rows (with profile fields)
 * @param {(profile: object) => boolean} [inScope] which accounts belong to this statement
 * @returns {{assignments: Map<string, object[]>, unmapped: object[], assisted: object[], exceptionalHeaders: object[]}}
 */
export function assignAccountsToLines(definition, accountRows, inScope = () => true) {
  const groupLines = definition.lines.filter((l) => l.lineType === 'ACCOUNT_GROUP');
  const assignments = new Map(groupLines.map((l) => [l.lineId, []]));
  const unmapped = [];
  const assisted = [];
  const exceptionalHeaders = [];
  for (const row of accountRows) {
    if (!isAmountBearingAccount(row)) continue;
    const profile = resolveAccountProfile(row);
    if (!inScope(profile)) continue;
    const target = groupLines.find((l) => accountMatchesRule(profile, l.match, row));
    if (!target) {
      unmapped.push({ ...row, profile });
      continue;
    }
    if (profile.classificationSource !== 'EXPLICIT') {
      assisted.push({ accountId: row.accountId, accountCode: row.accountCode, lineId: target.lineId });
    }
    if (row.exceptionalPostingAccount) {
      exceptionalHeaders.push({
        accountId: row.accountId,
        accountCode: row.accountCode,
        lineId: target.lineId,
      });
    }
    assignments.get(target.lineId).push(row);
  }
  return { assignments, unmapped, assisted, exceptionalHeaders };
}

/**
 * Evaluate a controlled formula over computed line minor amounts.
 * @param {Array<{op: '+'|'-', ref: string}>} formula
 * @param {Map<string, number>} lineMinors
 */
export function evaluateFormula(formula, lineMinors) {
  let total = 0;
  for (const term of formula) {
    const value = lineMinors.get(term.ref);
    if (value == null) {
      throw new AccountingValidationError(`Formula references unknown line "${term.ref}".`);
    }
    if (term.op === '+') total += value;
    else if (term.op === '-') total -= value;
    else throw new AccountingValidationError(`Unsupported formula operation "${term.op}".`);
  }
  return total;
}
