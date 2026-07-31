/**
 * CoA V2 — explicit financial-statement mapping (Phase 3 §24).
 *
 * Code ranges only provide DEFAULTS; the explicit mapping stored on the account
 * controls presentation. One account maps to exactly one statement section.
 * Headers are presentation-only and are excluded from statement line totals
 * (their totals derive from descendants) — preventing parent+child double counts.
 */

import { AccountCategory, isEnumValue } from '../../accountingV2/domain/enums.js';
import { AccountSubType, CONTRA_SUBTYPES } from './categories.js';

export const FinancialStatement = Object.freeze({
  INCOME_STATEMENT: 'INCOME_STATEMENT',
  FINANCIAL_POSITION: 'FINANCIAL_POSITION',
  CASH_FLOW: 'CASH_FLOW',
  CHANGES_IN_EQUITY: 'CHANGES_IN_EQUITY',
  TRIAL_BALANCE: 'TRIAL_BALANCE',
});

/** Sections per statement (business-language labels are UI concerns). */
export const FinancialStatementSection = Object.freeze({
  // Statement of Financial Position
  CURRENT_ASSETS: 'CURRENT_ASSETS',
  NON_CURRENT_ASSETS: 'NON_CURRENT_ASSETS',
  CURRENT_LIABILITIES: 'CURRENT_LIABILITIES',
  LONG_TERM_LIABILITIES: 'LONG_TERM_LIABILITIES',
  EQUITY: 'EQUITY',
  // Income Statement
  REVENUE: 'REVENUE',
  COST_OF_SALES: 'COST_OF_SALES',
  OPERATING_EXPENSES: 'OPERATING_EXPENSES',
  OTHER_INCOME: 'OTHER_INCOME',
  OTHER_EXPENSES: 'OTHER_EXPENSES',
  // Derived-only (never posted, never independently summed)
  CURRENT_YEAR_EARNINGS_DERIVED: 'CURRENT_YEAR_EARNINGS_DERIVED',
});

const FP = FinancialStatement.FINANCIAL_POSITION;
const IS = FinancialStatement.INCOME_STATEMENT;

/** Which sections belong to which statement. */
export const SECTION_STATEMENT = Object.freeze({
  [FinancialStatementSection.CURRENT_ASSETS]: FP,
  [FinancialStatementSection.NON_CURRENT_ASSETS]: FP,
  [FinancialStatementSection.CURRENT_LIABILITIES]: FP,
  [FinancialStatementSection.LONG_TERM_LIABILITIES]: FP,
  [FinancialStatementSection.EQUITY]: FP,
  [FinancialStatementSection.REVENUE]: IS,
  [FinancialStatementSection.COST_OF_SALES]: IS,
  [FinancialStatementSection.OPERATING_EXPENSES]: IS,
  [FinancialStatementSection.OTHER_INCOME]: IS,
  [FinancialStatementSection.OTHER_EXPENSES]: IS,
  [FinancialStatementSection.CURRENT_YEAR_EARNINGS_DERIVED]: FP,
});

/** Sections compatible with each category (COA-009 check base). */
export const CATEGORY_ALLOWED_SECTIONS = Object.freeze({
  [AccountCategory.ASSET]: [FinancialStatementSection.CURRENT_ASSETS, FinancialStatementSection.NON_CURRENT_ASSETS],
  [AccountCategory.LIABILITY]: [FinancialStatementSection.CURRENT_LIABILITIES, FinancialStatementSection.LONG_TERM_LIABILITIES],
  [AccountCategory.EQUITY]: [FinancialStatementSection.EQUITY, FinancialStatementSection.CURRENT_YEAR_EARNINGS_DERIVED],
  [AccountCategory.REVENUE]: [FinancialStatementSection.REVENUE],
  [AccountCategory.COST_OF_SALES]: [FinancialStatementSection.COST_OF_SALES],
  [AccountCategory.EXPENSE]: [FinancialStatementSection.OPERATING_EXPENSES, FinancialStatementSection.COST_OF_SALES],
  [AccountCategory.OTHER_INCOME]: [FinancialStatementSection.OTHER_INCOME],
  [AccountCategory.OTHER_EXPENSE]: [FinancialStatementSection.OTHER_EXPENSES],
});

/**
 * Default section derived from category/subtype — the starting point that
 * explicit mappings may override (within CATEGORY_ALLOWED_SECTIONS).
 */
export function defaultFinancialStatementSection(category, subType = null) {
  switch (category) {
    case AccountCategory.ASSET:
      return subType === AccountSubType.NON_CURRENT_ASSET
        ? FinancialStatementSection.NON_CURRENT_ASSETS
        : FinancialStatementSection.CURRENT_ASSETS;
    case AccountCategory.LIABILITY:
      return subType === AccountSubType.LONG_TERM_LIABILITY
        ? FinancialStatementSection.LONG_TERM_LIABILITIES
        : FinancialStatementSection.CURRENT_LIABILITIES;
    case AccountCategory.EQUITY:
      return subType === AccountSubType.CURRENT_YEAR_EARNINGS
        ? FinancialStatementSection.CURRENT_YEAR_EARNINGS_DERIVED
        : FinancialStatementSection.EQUITY;
    case AccountCategory.REVENUE:
      return FinancialStatementSection.REVENUE;
    case AccountCategory.COST_OF_SALES:
      return FinancialStatementSection.COST_OF_SALES;
    case AccountCategory.EXPENSE:
      return FinancialStatementSection.OPERATING_EXPENSES;
    case AccountCategory.OTHER_INCOME:
      return FinancialStatementSection.OTHER_INCOME;
    case AccountCategory.OTHER_EXPENSE:
      return FinancialStatementSection.OTHER_EXPENSES;
    default:
      return null;
  }
}

/**
 * Sign presentation: contra accounts display with a negative sign inside their
 * section (e.g. Accumulated Depreciation under assets, Sales Returns under revenue).
 */
export function signPresentation(category, subType = null) {
  return subType && CONTRA_SUBTYPES.has(subType) ? -1 : 1;
}

/**
 * Validate an explicit financial-statement mapping for an account.
 * @param {object} params
 * @param {string} params.category
 * @param {string|null} [params.subType]
 * @param {string} params.section FinancialStatementSection value
 * @param {string} [params.behaviour]
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateFinancialStatementMapping(params) {
  const errors = [];
  if (!isEnumValue(FinancialStatementSection, params.section)) {
    errors.push(`Unknown financial-statement section: ${String(params.section)}`);
    return { valid: false, errors };
  }
  const allowed = CATEGORY_ALLOWED_SECTIONS[params.category];
  if (!allowed) {
    errors.push(`Unknown category for statement mapping: ${String(params.category)}`);
  } else if (!allowed.includes(params.section)) {
    errors.push(`Section ${params.section} is incompatible with category ${params.category} (allowed: ${allowed.join(', ')})`);
  }
  if (params.section === FinancialStatementSection.CURRENT_YEAR_EARNINGS_DERIVED &&
      params.subType !== AccountSubType.CURRENT_YEAR_EARNINGS) {
    errors.push('Only Current Year Earnings accounts may map to the derived earnings section');
  }
  return { valid: errors.length === 0, errors };
}
