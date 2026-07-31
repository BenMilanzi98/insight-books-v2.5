/**
 * CoA V2 — account categories, subtypes, and normal-balance rules.
 *
 * Categories reuse the Phase 2 single-source enum (`AccountCategory`); this module adds
 * the subtype taxonomy and the category/subtype/normal-balance validation rules mandated
 * by Phase 3. Pure domain logic: no framework, database, or legacy imports.
 */

import { AccountCategory, AccountNormalBalance, isEnumValue } from '../../accountingV2/domain/enums.js';

export { AccountCategory, AccountNormalBalance };

/** Subtypes per category. Detail lives here — top-level categories stay stable. */
export const AccountSubType = Object.freeze({
  // ASSET
  CURRENT_ASSET: 'CURRENT_ASSET',
  NON_CURRENT_ASSET: 'NON_CURRENT_ASSET',
  CONTRA_ASSET: 'CONTRA_ASSET',
  // LIABILITY
  CURRENT_LIABILITY: 'CURRENT_LIABILITY',
  LONG_TERM_LIABILITY: 'LONG_TERM_LIABILITY',
  CONTRA_LIABILITY: 'CONTRA_LIABILITY',
  // EQUITY
  SHARE_CAPITAL: 'SHARE_CAPITAL',
  OWNER_CAPITAL: 'OWNER_CAPITAL',
  CAPITAL_CONTRIBUTION: 'CAPITAL_CONTRIBUTION',
  SHARE_PREMIUM: 'SHARE_PREMIUM',
  RETAINED_EARNINGS: 'RETAINED_EARNINGS',
  CURRENT_YEAR_EARNINGS: 'CURRENT_YEAR_EARNINGS',
  DRAWINGS: 'DRAWINGS',
  DIVIDENDS: 'DIVIDENDS',
  OTHER_EQUITY: 'OTHER_EQUITY',
  // REVENUE
  SALES_REVENUE: 'SALES_REVENUE',
  SERVICE_REVENUE: 'SERVICE_REVENUE',
  RENTAL_REVENUE: 'RENTAL_REVENUE',
  INTEREST_INCOME: 'INTEREST_INCOME',
  OTHER_OPERATING_REVENUE: 'OTHER_OPERATING_REVENUE',
  CONTRA_REVENUE: 'CONTRA_REVENUE',
  // COST_OF_SALES
  INVENTORY_COST: 'INVENTORY_COST',
  DIRECT_LABOUR: 'DIRECT_LABOUR',
  DIRECT_PRODUCTION_COST: 'DIRECT_PRODUCTION_COST',
  CONTRA_COST_OF_SALES: 'CONTRA_COST_OF_SALES',
  // EXPENSE
  PAYROLL_EXPENSE: 'PAYROLL_EXPENSE',
  ADMINISTRATIVE_EXPENSE: 'ADMINISTRATIVE_EXPENSE',
  SELLING_EXPENSE: 'SELLING_EXPENSE',
  OCCUPANCY_EXPENSE: 'OCCUPANCY_EXPENSE',
  FINANCE_EXPENSE: 'FINANCE_EXPENSE',
  DEPRECIATION_EXPENSE: 'DEPRECIATION_EXPENSE',
  TAX_EXPENSE: 'TAX_EXPENSE',
  CONTRA_EXPENSE: 'CONTRA_EXPENSE',
  // OTHER_INCOME / OTHER_EXPENSE
  ASSET_DISPOSAL_GAIN: 'ASSET_DISPOSAL_GAIN',
  FOREIGN_EXCHANGE_GAIN: 'FOREIGN_EXCHANGE_GAIN',
  NON_OPERATING_INCOME: 'NON_OPERATING_INCOME',
  ASSET_DISPOSAL_LOSS: 'ASSET_DISPOSAL_LOSS',
  FOREIGN_EXCHANGE_LOSS: 'FOREIGN_EXCHANGE_LOSS',
  NON_OPERATING_EXPENSE: 'NON_OPERATING_EXPENSE',
});

/** Which subtypes belong under each category. */
export const CATEGORY_SUBTYPES = Object.freeze({
  [AccountCategory.ASSET]: [
    AccountSubType.CURRENT_ASSET,
    AccountSubType.NON_CURRENT_ASSET,
    AccountSubType.CONTRA_ASSET,
  ],
  [AccountCategory.LIABILITY]: [
    AccountSubType.CURRENT_LIABILITY,
    AccountSubType.LONG_TERM_LIABILITY,
    AccountSubType.CONTRA_LIABILITY,
  ],
  [AccountCategory.EQUITY]: [
    AccountSubType.SHARE_CAPITAL,
    AccountSubType.OWNER_CAPITAL,
    AccountSubType.CAPITAL_CONTRIBUTION,
    AccountSubType.SHARE_PREMIUM,
    AccountSubType.RETAINED_EARNINGS,
    AccountSubType.CURRENT_YEAR_EARNINGS,
    AccountSubType.DRAWINGS,
    AccountSubType.DIVIDENDS,
    AccountSubType.OTHER_EQUITY,
  ],
  [AccountCategory.REVENUE]: [
    AccountSubType.SALES_REVENUE,
    AccountSubType.SERVICE_REVENUE,
    AccountSubType.RENTAL_REVENUE,
    AccountSubType.INTEREST_INCOME,
    AccountSubType.OTHER_OPERATING_REVENUE,
    AccountSubType.CONTRA_REVENUE,
  ],
  [AccountCategory.COST_OF_SALES]: [
    AccountSubType.INVENTORY_COST,
    AccountSubType.DIRECT_LABOUR,
    AccountSubType.DIRECT_PRODUCTION_COST,
    AccountSubType.CONTRA_COST_OF_SALES,
  ],
  [AccountCategory.EXPENSE]: [
    AccountSubType.PAYROLL_EXPENSE,
    AccountSubType.ADMINISTRATIVE_EXPENSE,
    AccountSubType.SELLING_EXPENSE,
    AccountSubType.OCCUPANCY_EXPENSE,
    AccountSubType.FINANCE_EXPENSE,
    AccountSubType.DEPRECIATION_EXPENSE,
    AccountSubType.TAX_EXPENSE,
    AccountSubType.CONTRA_EXPENSE,
  ],
  [AccountCategory.OTHER_INCOME]: [
    AccountSubType.ASSET_DISPOSAL_GAIN,
    AccountSubType.FOREIGN_EXCHANGE_GAIN,
    AccountSubType.NON_OPERATING_INCOME,
  ],
  [AccountCategory.OTHER_EXPENSE]: [
    AccountSubType.ASSET_DISPOSAL_LOSS,
    AccountSubType.FOREIGN_EXCHANGE_LOSS,
    AccountSubType.NON_OPERATING_EXPENSE,
  ],
});

/** Default normal balance per category (contra subtypes flip it). */
export const CATEGORY_NORMAL_BALANCE = Object.freeze({
  [AccountCategory.ASSET]: AccountNormalBalance.DEBIT,
  [AccountCategory.LIABILITY]: AccountNormalBalance.CREDIT,
  [AccountCategory.EQUITY]: AccountNormalBalance.CREDIT,
  [AccountCategory.REVENUE]: AccountNormalBalance.CREDIT,
  [AccountCategory.COST_OF_SALES]: AccountNormalBalance.DEBIT,
  [AccountCategory.EXPENSE]: AccountNormalBalance.DEBIT,
  [AccountCategory.OTHER_INCOME]: AccountNormalBalance.CREDIT,
  [AccountCategory.OTHER_EXPENSE]: AccountNormalBalance.DEBIT,
});

/** Subtypes whose normal balance is the OPPOSITE of the category default (contra). */
export const CONTRA_SUBTYPES = Object.freeze(new Set([
  AccountSubType.CONTRA_ASSET,
  AccountSubType.CONTRA_LIABILITY,
  AccountSubType.CONTRA_REVENUE,
  AccountSubType.CONTRA_COST_OF_SALES,
  AccountSubType.CONTRA_EXPENSE,
]));

/** Equity subtypes with debit normal balance (not "contra" but debit-normal equity). */
const DEBIT_NORMAL_EQUITY = new Set([AccountSubType.DRAWINGS, AccountSubType.DIVIDENDS]);

const opposite = (nb) =>
  nb === AccountNormalBalance.DEBIT ? AccountNormalBalance.CREDIT : AccountNormalBalance.DEBIT;

/**
 * The expected normal balance for a category/subtype pair.
 * @param {string} category AccountCategory value
 * @param {string|null} [subType] AccountSubType value
 */
export function expectedNormalBalance(category, subType = null) {
  const base = CATEGORY_NORMAL_BALANCE[category];
  if (!base) return null;
  if (subType && CONTRA_SUBTYPES.has(subType)) return opposite(base);
  if (subType && DEBIT_NORMAL_EQUITY.has(subType)) return AccountNormalBalance.DEBIT;
  return base;
}

/**
 * Validate a category / subtype / normal-balance combination.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateClassification({ category, subType = null, normalBalance = null }) {
  const errors = [];
  if (!isEnumValue(AccountCategory, category)) {
    errors.push(`Unknown account category: ${String(category)}`);
    return { valid: false, errors };
  }
  if (subType != null) {
    if (!isEnumValue(AccountSubType, subType)) {
      errors.push(`Unknown account subtype: ${String(subType)}`);
    } else if (!CATEGORY_SUBTYPES[category].includes(subType)) {
      errors.push(`Subtype ${subType} is not valid under category ${category}`);
    }
  }
  if (normalBalance != null) {
    if (!isEnumValue(AccountNormalBalance, normalBalance)) {
      errors.push(`Unknown normal balance: ${String(normalBalance)}`);
    } else if (errors.length === 0) {
      const expected = expectedNormalBalance(category, subType);
      if (expected && normalBalance !== expected) {
        errors.push(
          `Normal balance ${normalBalance} conflicts with ${category}${subType ? `/${subType}` : ''} (expected ${expected})`
        );
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Forbidden classifications (Phase 3 §7): explicit guards against the known
 * misclassification patterns from the Phase 1 audit.
 * Each rule receives { category, subType } and returns an error string when violated.
 */
export function forbiddenClassificationError({ category, subType }) {
  if (category === AccountCategory.REVENUE &&
      [AccountSubType.OWNER_CAPITAL, AccountSubType.CAPITAL_CONTRIBUTION, AccountSubType.SHARE_CAPITAL].includes(subType)) {
    return 'Owner capital / capital contributions must not be classified as revenue';
  }
  if (category === AccountCategory.EXPENSE && subType === AccountSubType.DRAWINGS) {
    return 'Owner drawings must not be classified as operating expense';
  }
  return null;
}

/** Categories that appear on the Income Statement (P&L). */
export const PROFIT_AND_LOSS_CATEGORIES = Object.freeze([
  AccountCategory.REVENUE,
  AccountCategory.COST_OF_SALES,
  AccountCategory.EXPENSE,
  AccountCategory.OTHER_INCOME,
  AccountCategory.OTHER_EXPENSE,
]);

/** Categories that appear on the Statement of Financial Position. */
export const BALANCE_SHEET_CATEGORIES = Object.freeze([
  AccountCategory.ASSET,
  AccountCategory.LIABILITY,
  AccountCategory.EQUITY,
]);

/**
 * Map a legacy `Account.type` / `accountType` string to a V2 category.
 * Used ONLY by the Stage-2 backfill where the legacy value is unambiguous.
 * Returns null when the legacy value cannot be classified without review.
 * @param {string|null|undefined} legacyType
 */
export function categoryFromLegacyType(legacyType) {
  const t = String(legacyType ?? '').trim().toLowerCase();
  switch (t) {
    case 'asset': return AccountCategory.ASSET;
    case 'liability': return AccountCategory.LIABILITY;
    case 'equity': return AccountCategory.EQUITY;
    case 'income':
    case 'revenue': return AccountCategory.REVENUE;
    case 'expense': return AccountCategory.EXPENSE;
    default: return null;
  }
}
