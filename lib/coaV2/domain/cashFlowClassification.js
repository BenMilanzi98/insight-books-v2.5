/**
 * CoA V2 — Cash Flow classification (Phase 3 §25).
 *
 * Phase 3 provides valid ACCOUNT classifications for the Phase 7 Cash Flow
 * rebuild; it does not rebuild the report. Defaults derive from category,
 * subtype, and system purpose; explicit values on the account override.
 */

import { AccountCategory, isEnumValue } from '../../accountingV2/domain/enums.js';
import { AccountSubType } from './categories.js';

export const CashFlowClassification = Object.freeze({
  OPERATING: 'OPERATING',
  INVESTING: 'INVESTING',
  FINANCING: 'FINANCING',
  CASH_AND_CASH_EQUIVALENT: 'CASH_AND_CASH_EQUIVALENT',
  NON_CASH: 'NON_CASH',
  UNCLASSIFIED: 'UNCLASSIFIED',
});

/** Purposes with a fixed classification regardless of category defaults. */
const PURPOSE_CLASSIFICATION = Object.freeze({
  CASH_ON_HAND: CashFlowClassification.CASH_AND_CASH_EQUIVALENT,
  PETTY_CASH: CashFlowClassification.CASH_AND_CASH_EQUIVALENT,
  PRIMARY_BANK: CashFlowClassification.CASH_AND_CASH_EQUIVALENT,
  MOBILE_MONEY: CashFlowClassification.CASH_AND_CASH_EQUIVALENT,
  POS_CLEARING: CashFlowClassification.CASH_AND_CASH_EQUIVALENT,
  FIXED_ASSET: CashFlowClassification.INVESTING,
  ACCUMULATED_DEPRECIATION: CashFlowClassification.NON_CASH,
  DEPRECIATION_EXPENSE: CashFlowClassification.NON_CASH,
  ASSET_DISPOSAL_GAIN: CashFlowClassification.INVESTING,
  ASSET_DISPOSAL_LOSS: CashFlowClassification.INVESTING,
  LOAN_LIABILITY: CashFlowClassification.FINANCING,
  OWNER_CAPITAL: CashFlowClassification.FINANCING,
  SHARE_CAPITAL: CashFlowClassification.FINANCING,
  CAPITAL_CONTRIBUTIONS: CashFlowClassification.FINANCING,
  SHARE_PREMIUM: CashFlowClassification.FINANCING,
  OWNER_DRAWINGS: CashFlowClassification.FINANCING,
  DIVIDENDS_PAYABLE: CashFlowClassification.FINANCING,
  RETAINED_EARNINGS: CashFlowClassification.NON_CASH,
  CURRENT_YEAR_EARNINGS: CashFlowClassification.NON_CASH,
  OPENING_BALANCE_EQUITY: CashFlowClassification.NON_CASH,
});

/**
 * Default classification for an account.
 * @param {object} params
 * @param {string|null} params.category
 * @param {string|null} [params.subType]
 * @param {string|null} [params.systemPurpose]
 */
export function defaultCashFlowClassification({ category, subType = null, systemPurpose = null }) {
  if (systemPurpose && PURPOSE_CLASSIFICATION[systemPurpose]) {
    return PURPOSE_CLASSIFICATION[systemPurpose];
  }
  switch (category) {
    case AccountCategory.REVENUE:
    case AccountCategory.COST_OF_SALES:
    case AccountCategory.EXPENSE:
      if (subType === AccountSubType.DEPRECIATION_EXPENSE) return CashFlowClassification.NON_CASH;
      if (subType === AccountSubType.FINANCE_EXPENSE) return CashFlowClassification.OPERATING;
      return CashFlowClassification.OPERATING;
    case AccountCategory.OTHER_INCOME:
      if (subType === AccountSubType.ASSET_DISPOSAL_GAIN) return CashFlowClassification.INVESTING;
      return CashFlowClassification.OPERATING;
    case AccountCategory.OTHER_EXPENSE:
      if (subType === AccountSubType.ASSET_DISPOSAL_LOSS) return CashFlowClassification.INVESTING;
      return CashFlowClassification.OPERATING;
    case AccountCategory.ASSET:
      if (subType === AccountSubType.NON_CURRENT_ASSET) return CashFlowClassification.INVESTING;
      if (subType === AccountSubType.CONTRA_ASSET) return CashFlowClassification.NON_CASH;
      return CashFlowClassification.OPERATING; // working capital by default; cash purposes override
    case AccountCategory.LIABILITY:
      if (subType === AccountSubType.LONG_TERM_LIABILITY) return CashFlowClassification.FINANCING;
      return CashFlowClassification.OPERATING;
    case AccountCategory.EQUITY:
      return CashFlowClassification.FINANCING;
    default:
      return CashFlowClassification.UNCLASSIFIED;
  }
}

/** @param {unknown} value */
export function isCashFlowClassification(value) {
  return isEnumValue(CashFlowClassification, value);
}
