/**
 * Temporary account identification from CoA metadata (not account-name text).
 * MODEL A: Current Year Earnings is a calculated reporting line — never closed
 * as if it were an independently posted P&L control that also transfers.
 */

import { TEMPORARY_CATEGORIES, PERMANENT_CATEGORIES } from './enums.js';

const TEMPORARY_SUBTYPES = new Set([
  'SALES_REVENUE',
  'SERVICE_REVENUE',
  'RENTAL_REVENUE',
  'INTEREST_INCOME',
  'OTHER_OPERATING_REVENUE',
  'CONTRA_REVENUE',
  'COST_OF_SALES',
  'DIRECT_COSTS',
  'PAYROLL_EXPENSE',
  'ADMINISTRATIVE_EXPENSE',
  'SELLING_EXPENSE',
  'OCCUPANCY_EXPENSE',
  'FINANCE_EXPENSE',
  'DEPRECIATION_EXPENSE',
  'TAX_EXPENSE',
  'CONTRA_EXPENSE',
  'NON_OPERATING_INCOME',
  'NON_OPERATING_EXPENSE',
  'GAIN_ON_DISPOSAL',
  'LOSS_ON_DISPOSAL',
]);

const NEVER_TEMPORARY_SUBTYPES = new Set([
  'RETAINED_EARNINGS',
  'CURRENT_YEAR_EARNINGS',
  'SHARE_CAPITAL',
  'OWNER_CAPITAL',
  'SHARE_PREMIUM',
  'CAPITAL_CONTRIBUTION',
  'DRAWINGS',
  'DIVIDENDS',
]);

/**
 * @param {{ category?: string, accountType?: string, subType?: string, coaV2SubType?: string, systemPurpose?: string, isHeader?: boolean }} account
 */
export function isTemporaryIncomeStatementAccount(account) {
  if (!account || account.isHeader) return false;
  const category = String(account.category || account.accountType || '').toUpperCase();
  const subType = String(account.subType || account.coaV2SubType || '').toUpperCase();
  const purpose = String(account.systemPurpose || '').toUpperCase();

  if (NEVER_TEMPORARY_SUBTYPES.has(subType) || NEVER_TEMPORARY_SUBTYPES.has(purpose)) {
    return false;
  }
  if (PERMANENT_CATEGORIES.includes(category)) return false;
  if (TEMPORARY_CATEGORIES.includes(category)) return true;
  if (TEMPORARY_SUBTYPES.has(subType)) return true;
  return false;
}

/**
 * Drawings are temporary equity contra — closed to capital, never through IS.
 */
export function isDrawingsAccount(account) {
  const subType = String(account?.subType || account?.coaV2SubType || '').toUpperCase();
  const purpose = String(account?.systemPurpose || '').toUpperCase();
  return subType === 'DRAWINGS' || purpose === 'OWNER_DRAWINGS' || purpose === 'PARTNER_DRAWINGS';
}

export function validateTemporaryAccountClassification(accounts) {
  const defects = [];
  for (const a of accounts) {
    const category = String(a.category || a.accountType || '').toUpperCase();
    const subType = String(a.subType || a.coaV2SubType || '').toUpperCase();
    const temp = isTemporaryIncomeStatementAccount(a);

    if (temp && PERMANENT_CATEGORIES.includes(category)) {
      defects.push({
        code: 'CLS-005',
        accountId: a.accountId || a.id,
        message: 'Permanent category incorrectly classified as temporary.',
      });
    }
    if ((subType === 'RETAINED_EARNINGS' || subType === 'SHARE_CAPITAL') && temp) {
      defects.push({
        code: 'CLS-005',
        accountId: a.accountId || a.id,
        message: `${subType} must not be temporary.`,
      });
    }
    if (subType === 'CURRENT_YEAR_EARNINGS' && temp) {
      defects.push({
        code: 'CLS-010',
        accountId: a.accountId || a.id,
        message: 'Current Year Earnings must not be closed as a temporary IS account under MODEL A.',
      });
    }
    if (category === 'REVENUE' && !temp && !a.isHeader) {
      defects.push({
        code: 'CLS-003',
        accountId: a.accountId || a.id,
        message: 'Revenue account not identified as temporary.',
      });
    }
  }
  return defects;
}

export function roleForTemporaryCategory(category, subType) {
  const cat = String(category || '').toUpperCase();
  const st = String(subType || '').toUpperCase();
  if (cat === 'REVENUE') return 'CLOSE_REVENUE';
  if (cat === 'OTHER_INCOME') return 'CLOSE_OTHER_INCOME';
  if (cat === 'COST_OF_SALES') return 'CLOSE_COST_OF_SALES';
  if (cat === 'OTHER_EXPENSE') return 'CLOSE_OTHER_EXPENSE';
  if (cat === 'EXPENSE' && st === 'TAX_EXPENSE') return 'CLOSE_TAX_EXPENSE';
  if (cat === 'EXPENSE') return 'CLOSE_EXPENSE';
  return 'CLOSE_EXPENSE';
}
