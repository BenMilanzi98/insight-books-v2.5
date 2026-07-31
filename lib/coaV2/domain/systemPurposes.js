/**
 * CoA V2 — system-account purpose registry (Phase 3 §12–14).
 *
 * Single catalogue of accounting purposes the engine can resolve. Each purpose
 * declares the categories, behaviours, and normal balance a mapped account must
 * satisfy. A business configures only the purposes it needs; every ACTIVE purpose
 * mapping must resolve to exactly one valid account per context.
 *
 * Pure domain: constraint data + validation. Resolution lives in the application
 * layer (accountMappingRegistry.js).
 */

import { AccountCategory, AccountBehaviour, AccountNormalBalance, isEnumValue } from '../../accountingV2/domain/enums.js';
import { AccountSubType } from './categories.js';
import { expectedNormalBalance } from './categories.js';
import { AccountLifecycleStatus } from './behaviours.js';

const { ASSET, LIABILITY, EQUITY, REVENUE, COST_OF_SALES, EXPENSE, OTHER_INCOME, OTHER_EXPENSE } = AccountCategory;
const { POSTING, CONTROL, SYSTEM, CONTRA } = AccountBehaviour;
const { DEBIT, CREDIT } = AccountNormalBalance;

/**
 * @typedef {object} PurposeConstraint
 * @property {string[]} categories allowed AccountCategory values
 * @property {string[]} behaviours allowed AccountBehaviour values
 * @property {string} [normalBalance] required normal balance
 * @property {string[]} [subTypes] recommended subtypes (warning when different)
 * @property {boolean} [protectedAccount] mapped account becomes protected (no delete/archive)
 * @property {boolean} [manualPostingRestricted] manual journals need elevated permission
 * @property {string} [requiredDimension] subledger dimension operational postings must carry
 * @property {boolean} [uniquePerContext] only one active mapping per business+currency context (default true)
 * @property {string} [legacyCode] blueprint code used by the Stage-2 backfill and the legacy fallback
 * @property {string} [notes]
 */

/** @type {Record<string, PurposeConstraint>} */
export const SYSTEM_ACCOUNT_PURPOSES = Object.freeze({
  // Cash and banking
  CASH_ON_HAND: { categories: [ASSET], behaviours: [POSTING, SYSTEM], normalBalance: DEBIT, subTypes: [AccountSubType.CURRENT_ASSET], legacyCode: '1110' },
  PETTY_CASH: { categories: [ASSET], behaviours: [POSTING], normalBalance: DEBIT, subTypes: [AccountSubType.CURRENT_ASSET], legacyCode: '1120' },
  PRIMARY_BANK: { categories: [ASSET], behaviours: [POSTING, SYSTEM], normalBalance: DEBIT, subTypes: [AccountSubType.CURRENT_ASSET], legacyCode: '1131', notes: 'Post to bank leaf (1131-xx); 1130 is a header.' },
  MOBILE_MONEY: { categories: [ASSET], behaviours: [POSTING], normalBalance: DEBIT, subTypes: [AccountSubType.CURRENT_ASSET], legacyCode: '1140', notes: 'Prefer posting leaf under 1140/1141.' },
  POS_CLEARING: { categories: [ASSET], behaviours: [POSTING], normalBalance: DEBIT, subTypes: [AccountSubType.CURRENT_ASSET], legacyCode: '1145' },

  // Receivables
  ACCOUNTS_RECEIVABLE: { categories: [ASSET], behaviours: [CONTROL], normalBalance: DEBIT, subTypes: [AccountSubType.CURRENT_ASSET], protectedAccount: true, manualPostingRestricted: true, requiredDimension: 'customerId', legacyCode: '1200' },
  ALLOWANCE_FOR_DOUBTFUL_DEBTS: { categories: [ASSET], behaviours: [CONTRA], normalBalance: CREDIT, subTypes: [AccountSubType.CONTRA_ASSET] },
  SALARY_ADVANCE: { categories: [ASSET], behaviours: [POSTING], normalBalance: DEBIT, subTypes: [AccountSubType.CURRENT_ASSET], legacyCode: '1216' },

  // Inventory
  INVENTORY: { categories: [ASSET], behaviours: [POSTING, CONTROL], normalBalance: DEBIT, subTypes: [AccountSubType.CURRENT_ASSET], legacyCode: '1310' },
  INVENTORY_ADJUSTMENT: { categories: [COST_OF_SALES, EXPENSE], behaviours: [POSTING], normalBalance: DEBIT, legacyCode: '5290' },

  // Payables and statutory liabilities
  ACCOUNTS_PAYABLE: { categories: [LIABILITY], behaviours: [CONTROL], normalBalance: CREDIT, subTypes: [AccountSubType.CURRENT_LIABILITY], protectedAccount: true, manualPostingRestricted: true, requiredDimension: 'supplierId', legacyCode: '2110' },
  /** Goods Received Not Invoiced — accrual clearing between inventory receipt and supplier bill. */
  GRNI: { categories: [LIABILITY], behaviours: [CONTROL, POSTING], normalBalance: CREDIT, subTypes: [AccountSubType.CURRENT_LIABILITY], protectedAccount: true, manualPostingRestricted: true, requiredDimension: 'supplierId', legacyCode: '2115', notes: 'Credit on goods receipt; debit when matched supplier bill posts. Never conflate with trade AP.' },
  VAT_INPUT: { categories: [ASSET], behaviours: [POSTING, SYSTEM], normalBalance: DEBIT, subTypes: [AccountSubType.CURRENT_ASSET], legacyCode: '1240' },
  VAT_OUTPUT: { categories: [LIABILITY], behaviours: [POSTING, SYSTEM], normalBalance: CREDIT, subTypes: [AccountSubType.CURRENT_LIABILITY], legacyCode: '2120', notes: 'Prefer VAT Payable leaf 2120; 2041 is tax-inflow header.' },
  VAT_PAYABLE: { categories: [LIABILITY], behaviours: [POSTING, SYSTEM], normalBalance: CREDIT, subTypes: [AccountSubType.CURRENT_LIABILITY], legacyCode: '2120' },
  PAYE_PAYABLE: { categories: [LIABILITY], behaviours: [POSTING, SYSTEM], normalBalance: CREDIT, subTypes: [AccountSubType.CURRENT_LIABILITY], legacyCode: '2130' },
  PENSION_PAYABLE: { categories: [LIABILITY], behaviours: [POSTING, SYSTEM], normalBalance: CREDIT, subTypes: [AccountSubType.CURRENT_LIABILITY] },
  SALARY_DEDUCTIONS_PAYABLE: { categories: [LIABILITY], behaviours: [POSTING, SYSTEM], normalBalance: CREDIT, subTypes: [AccountSubType.CURRENT_LIABILITY] },
  WITHHOLDING_TAX_PAYABLE: { categories: [LIABILITY], behaviours: [POSTING, SYSTEM], normalBalance: CREDIT, subTypes: [AccountSubType.CURRENT_LIABILITY], legacyCode: '2045' },
  INTEREST_PAYABLE: { categories: [LIABILITY], behaviours: [POSTING], normalBalance: CREDIT, subTypes: [AccountSubType.CURRENT_LIABILITY] },
  DIVIDENDS_PAYABLE: { categories: [LIABILITY], behaviours: [POSTING], normalBalance: CREDIT, subTypes: [AccountSubType.CURRENT_LIABILITY] },
  LOAN_LIABILITY: { categories: [LIABILITY], behaviours: [POSTING], normalBalance: CREDIT, legacyCode: '2510', notes: 'Never revenue: loan proceeds credit this account.' },
  CORPORATE_TAX_PAYABLE: { categories: [LIABILITY], behaviours: [POSTING], normalBalance: CREDIT, subTypes: [AccountSubType.CURRENT_LIABILITY] },

  // Revenue
  SALES_REVENUE: { categories: [REVENUE], behaviours: [POSTING, SYSTEM], normalBalance: CREDIT, subTypes: [AccountSubType.SALES_REVENUE], legacyCode: '4100' },
  SERVICE_REVENUE: { categories: [REVENUE], behaviours: [POSTING], normalBalance: CREDIT, subTypes: [AccountSubType.SERVICE_REVENUE], legacyCode: '4150' },
  RENTAL_REVENUE: { categories: [REVENUE], behaviours: [POSTING], normalBalance: CREDIT, subTypes: [AccountSubType.RENTAL_REVENUE] },
  OTHER_INCOME: { categories: [REVENUE, OTHER_INCOME], behaviours: [POSTING], normalBalance: CREDIT, legacyCode: '4900' },
  SALES_RETURNS: { categories: [REVENUE], behaviours: [CONTRA], normalBalance: DEBIT, subTypes: [AccountSubType.CONTRA_REVENUE], legacyCode: '4110' },

  // Cost of sales and expenses
  COST_OF_SALES: { categories: [COST_OF_SALES, EXPENSE], behaviours: [POSTING, SYSTEM], normalBalance: DEBIT, legacyCode: '5110', notes: 'Post to COGS leaf 5110+; 5100 is header.' },
  SALARIES_AND_WAGES: { categories: [EXPENSE], behaviours: [POSTING, SYSTEM], normalBalance: DEBIT, subTypes: [AccountSubType.PAYROLL_EXPENSE], protectedAccount: true, legacyCode: '5200', notes: 'Canonical account 5200. Must never resolve to liability or equity.' },
  EMPLOYER_PENSION_EXPENSE: { categories: [EXPENSE], behaviours: [POSTING], normalBalance: DEBIT, subTypes: [AccountSubType.PAYROLL_EXPENSE], legacyCode: '5220' },
  RENT_EXPENSE: { categories: [EXPENSE], behaviours: [POSTING], normalBalance: DEBIT, subTypes: [AccountSubType.OCCUPANCY_EXPENSE], legacyCode: '5300' },
  UTILITIES_EXPENSE: { categories: [EXPENSE], behaviours: [POSTING], normalBalance: DEBIT, subTypes: [AccountSubType.OCCUPANCY_EXPENSE], legacyCode: '5310' },
  BANK_CHARGES: { categories: [EXPENSE], behaviours: [POSTING], normalBalance: DEBIT, subTypes: [AccountSubType.FINANCE_EXPENSE], legacyCode: '5500' },
  INTEREST_EXPENSE: { categories: [EXPENSE], behaviours: [POSTING], normalBalance: DEBIT, subTypes: [AccountSubType.FINANCE_EXPENSE], legacyCode: '5510' },
  DEPRECIATION_EXPENSE: { categories: [EXPENSE], behaviours: [POSTING], normalBalance: DEBIT, subTypes: [AccountSubType.DEPRECIATION_EXPENSE], legacyCode: '5400' },
  BAD_DEBT_EXPENSE: { categories: [EXPENSE], behaviours: [POSTING], normalBalance: DEBIT, legacyCode: '5390' },
  CORPORATE_TAX_EXPENSE: { categories: [EXPENSE], behaviours: [POSTING], normalBalance: DEBIT, subTypes: [AccountSubType.TAX_EXPENSE], legacyCode: '5580' },

  // Fixed assets
  FIXED_ASSET: { categories: [ASSET], behaviours: [POSTING], normalBalance: DEBIT, subTypes: [AccountSubType.NON_CURRENT_ASSET], legacyCode: '1510' },
  ACCUMULATED_DEPRECIATION: { categories: [ASSET], behaviours: [CONTRA], normalBalance: CREDIT, subTypes: [AccountSubType.CONTRA_ASSET], legacyCode: '1590' },
  ASSET_DISPOSAL_GAIN: { categories: [OTHER_INCOME], behaviours: [POSTING], normalBalance: CREDIT, subTypes: [AccountSubType.ASSET_DISPOSAL_GAIN] },
  ASSET_DISPOSAL_LOSS: { categories: [OTHER_EXPENSE, EXPENSE], behaviours: [POSTING], normalBalance: DEBIT, subTypes: [AccountSubType.ASSET_DISPOSAL_LOSS], legacyCode: '5640' },
  EMPLOYEE_PAYABLES: { categories: [LIABILITY], behaviours: [POSTING], normalBalance: CREDIT, legacyCode: '2170' },
  CREDIT_CARD_PAYABLE: { categories: [LIABILITY], behaviours: [POSTING], normalBalance: CREDIT, legacyCode: '2180' },

  // Equity
  OWNER_CAPITAL: { categories: [EQUITY], behaviours: [POSTING, SYSTEM], normalBalance: CREDIT, subTypes: [AccountSubType.OWNER_CAPITAL], protectedAccount: true, legacyCode: '3100' },
  SHARE_CAPITAL: { categories: [EQUITY], behaviours: [POSTING], normalBalance: CREDIT, subTypes: [AccountSubType.SHARE_CAPITAL] },
  CAPITAL_CONTRIBUTIONS: { categories: [EQUITY], behaviours: [POSTING], normalBalance: CREDIT, subTypes: [AccountSubType.CAPITAL_CONTRIBUTION] },
  SHARE_PREMIUM: { categories: [EQUITY], behaviours: [POSTING], normalBalance: CREDIT, subTypes: [AccountSubType.SHARE_PREMIUM] },
  RETAINED_EARNINGS: { categories: [EQUITY], behaviours: [SYSTEM], normalBalance: CREDIT, subTypes: [AccountSubType.RETAINED_EARNINGS], protectedAccount: true, manualPostingRestricted: true, legacyCode: '3200' },
  CURRENT_YEAR_EARNINGS: { categories: [EQUITY], behaviours: [SYSTEM], normalBalance: CREDIT, subTypes: [AccountSubType.CURRENT_YEAR_EARNINGS], protectedAccount: true, manualPostingRestricted: true, legacyCode: '3300', notes: 'Derived from posted P&L activity — never an ordinary selectable posting account.' },
  OWNER_DRAWINGS: { categories: [EQUITY], behaviours: [POSTING], normalBalance: DEBIT, subTypes: [AccountSubType.DRAWINGS], notes: 'Equity, debit-normal. Never an operating expense.' },
  OPENING_BALANCE_EQUITY: { categories: [EQUITY], behaviours: [SYSTEM], normalBalance: CREDIT, subTypes: [AccountSubType.OTHER_EQUITY], protectedAccount: true, manualPostingRestricted: true, legacyCode: '3190' },

  // Special
  SUSPENSE_ACCOUNT: { categories: [EQUITY], behaviours: [SYSTEM], normalBalance: CREDIT, protectedAccount: true, manualPostingRestricted: true, legacyCode: '3999', notes: 'Deliberate suspense policy only; postings require authorization.' },
  ROUNDING_DIFFERENCE: { categories: [EXPENSE, OTHER_EXPENSE], behaviours: [POSTING, SYSTEM], normalBalance: DEBIT },
  FOREIGN_EXCHANGE_GAIN: { categories: [OTHER_INCOME], behaviours: [POSTING], normalBalance: CREDIT, subTypes: [AccountSubType.FOREIGN_EXCHANGE_GAIN], legacyCode: '4300' },
  FOREIGN_EXCHANGE_LOSS: { categories: [OTHER_EXPENSE, EXPENSE], behaviours: [POSTING], normalBalance: DEBIT, subTypes: [AccountSubType.FOREIGN_EXCHANGE_LOSS], legacyCode: '5520' },
});

export const SystemAccountPurpose = Object.freeze(
  Object.fromEntries(Object.keys(SYSTEM_ACCOUNT_PURPOSES).map((k) => [k, k]))
);

/** Purposes whose mapped account must never be deleted/archived while mapped. */
export function isProtectedPurpose(purpose) {
  return SYSTEM_ACCOUNT_PURPOSES[purpose]?.protectedAccount === true;
}

/** Purposes ordinary users may not create/re-map without elevated permission. */
export const ELEVATED_PURPOSES = Object.freeze(
  Object.keys(SYSTEM_ACCOUNT_PURPOSES).filter(
    (p) => SYSTEM_ACCOUNT_PURPOSES[p].protectedAccount || SYSTEM_ACCOUNT_PURPOSES[p].manualPostingRestricted
  )
);

/**
 * Validate that a candidate account satisfies a purpose's constraints.
 * The candidate is a V2-classified account snapshot (fields may be null for
 * unclassified legacy rows — those produce explicit errors, not silent passes).
 *
 * @param {string} purpose SystemAccountPurpose value
 * @param {object} account
 * @param {string|null} account.tenantId
 * @param {string|null} account.category V2 category
 * @param {string|null} account.subType
 * @param {string|null} account.behaviour
 * @param {string|null} account.normalBalance V2 normal balance (DEBIT/CREDIT)
 * @param {string|null} account.status lifecycle status
 * @param {boolean} [account.isActive]
 * @param {boolean} [account.hasActiveChildren]
 * @param {object} [context]
 * @param {string} [context.businessId] required tenant scope
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateAccountForPurpose(purpose, account, context = {}) {
  const errors = [];
  const warnings = [];
  const constraint = SYSTEM_ACCOUNT_PURPOSES[purpose];
  if (!constraint) {
    errors.push(`Unknown system account purpose: ${String(purpose)}`);
    return { valid: false, errors, warnings };
  }
  if (context.businessId && account.tenantId !== context.businessId) {
    errors.push('Mapped account belongs to a different business');
  }
  if (account.status === AccountLifecycleStatus.DEPRECATED) {
    errors.push('Mapped account is deprecated');
  }
  if (account.status === AccountLifecycleStatus.ARCHIVED) {
    errors.push('Mapped account is archived');
  }
  if (account.isActive === false) {
    errors.push('Mapped account is inactive');
  }
  if (account.hasActiveChildren === true) {
    errors.push('Mapped account is a header/parent account and cannot receive postings');
  }
  if (account.category == null) {
    errors.push('Account has no V2 category classification; classify it before mapping');
  } else if (!constraint.categories.includes(account.category)) {
    errors.push(`Purpose ${purpose} requires category ${constraint.categories.join(' or ')}, account is ${account.category}`);
  }
  if (account.behaviour == null) {
    errors.push('Account has no behaviour classification; classify it before mapping');
  } else if (!constraint.behaviours.includes(account.behaviour)) {
    errors.push(`Purpose ${purpose} requires behaviour ${constraint.behaviours.join(' or ')}, account is ${account.behaviour}`);
  }
  if (constraint.normalBalance) {
    const actual = account.normalBalance ?? (account.category ? expectedNormalBalance(account.category, account.subType) : null);
    if (actual !== constraint.normalBalance) {
      errors.push(`Purpose ${purpose} requires ${constraint.normalBalance} normal balance, account is ${actual ?? 'unclassified'}`);
    }
  }
  if (constraint.subTypes && account.subType && !constraint.subTypes.includes(account.subType)) {
    warnings.push(`Subtype ${account.subType} is unusual for purpose ${purpose} (expected ${constraint.subTypes.join(' or ')})`);
  }
  return { valid: errors.length === 0, errors, warnings };
}

/** @param {unknown} value */
export function isSystemAccountPurpose(value) {
  return isEnumValue(SystemAccountPurpose, value);
}
