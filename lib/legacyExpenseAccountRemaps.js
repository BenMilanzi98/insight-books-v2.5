/**
 * Legacy / duplicate tenant expense account codes — P&L display merges and
 * content-based reclassification when rows are miscoded on the wrong GL account.
 */

import { lookupStandardExpenseCodeFromCategorySync } from './expenseCategoryNormalization.js';
import { isPayrollDashboardMirrorExpense } from './incomeStatementExpenseDedup.js';
import {
  CANONICAL_SALARY_ACCOUNT_CODE,
  isLegacySalaryBucketCode,
} from './salaryExpenseAccountCodes.js';

export const CANONICAL_OVERTIME_ALLOWANCE_CODE = '5018';
export const CANONICAL_OVERTIME_ALLOWANCE_NAME = 'Overtime allowance';

export const CANONICAL_IT_HOSTING_CODE = '5350';
export const CANONICAL_IT_HOSTING_NAME = 'IT & Hosting';

export const CANONICAL_RENT_LEASE_CODE = '5300';
export const CANONICAL_RENT_LEASE_NAME = 'Rent & Lease';

export const CANONICAL_MARKETING_CODE = '5330';
export const CANONICAL_MARKETING_NAME = 'Marketing & Advertising';

export const CANONICAL_BANK_CHARGES_CODE = '5500';
export const CANONICAL_BANK_CHARGES_NAME = 'Bank Charges & Fees';

export const CANONICAL_TRAVEL_TRANSPORT_CODE = '5340';
export const CANONICAL_TRAVEL_TRANSPORT_NAME = 'Travel & Transport';

export const CANONICAL_LEGAL_PROFESSIONAL_CODE = '5360';
export const CANONICAL_LEGAL_PROFESSIONAL_NAME = 'Legal & Professional Fees';

/** Default P&L labels when tenant CoA name is unavailable. */
export const CANONICAL_EXPENSE_DISPLAY_NAMES = {
  [CANONICAL_OVERTIME_ALLOWANCE_CODE]: CANONICAL_OVERTIME_ALLOWANCE_NAME,
  [CANONICAL_IT_HOSTING_CODE]: CANONICAL_IT_HOSTING_NAME,
  [CANONICAL_RENT_LEASE_CODE]: CANONICAL_RENT_LEASE_NAME,
  [CANONICAL_MARKETING_CODE]: CANONICAL_MARKETING_NAME,
  [CANONICAL_BANK_CHARGES_CODE]: CANONICAL_BANK_CHARGES_NAME,
  [CANONICAL_TRAVEL_TRANSPORT_CODE]: CANONICAL_TRAVEL_TRANSPORT_NAME,
  [CANONICAL_LEGAL_PROFESSIONAL_CODE]: CANONICAL_LEGAL_PROFESSIONAL_NAME,
  [CANONICAL_SALARY_ACCOUNT_CODE]: 'Salaries & Wages',
};

/** @type {Set<string>} */
export const DUPLICATE_OVERTIME_ALLOWANCE_CODES = new Set(['5017']);

/** Legacy software / hosting shells rolled into 5702 for reporting. */
/** @type {Set<string>} */
export const LEGACY_IT_HOSTING_ACCOUNT_CODES = new Set([
  '5015',
  '5019',
  '5600',
  '5601',
  '5701',
  '5702',
]);

/**
 * Accounts whose register/GL link may be wrong — P&L reclassifies by content.
 * @type {Set<string>}
 */
export const CONTENT_RECLASSIFY_ACCOUNT_CODES = new Set([CANONICAL_LEGAL_PROFESSIONAL_CODE]);

/**
 * Direct code → survivor merges for P&L grouping (does not move GL postings).
 * @type {Record<string, string>}
 */
export const LEGACY_EXPENSE_ACCOUNT_MERGE_MAP = {
  5017: CANONICAL_OVERTIME_ALLOWANCE_CODE,
  5019: CANONICAL_IT_HOSTING_CODE,
  5015: CANONICAL_IT_HOSTING_CODE,
  5600: CANONICAL_IT_HOSTING_CODE,
  5601: CANONICAL_IT_HOSTING_CODE,
  5701: CANONICAL_IT_HOSTING_CODE,
};

const SOFTWARE_IT_HOSTING_PATTERN =
  /software|subscription|subscriptions|cursor|hosting|inmotion|saas|cloud|domain|it\s*(?:&|and)\s*hosting|ai\s*sub|hosting\s*fee|web\s*host|server\s*host|insightbooks|system\s*development|software\s*development|development\s*expense|dev\s*expense|\bdevelopment\b|\bdeveloper\b|programming|app\s*development|web\s*development/i;

const OVERTIME_ALLOWANCE_PATTERN = /overtime|ovetime|ot\s*allowance|over\s*time\s*allowance/i;

const RENT_LEASE_PATTERN = /\brent\b|\blease\b|office\s*rent|premises|landlord/i;

const BANK_CHARGES_PATTERN =
  /bank\s*charge|bank\s*service|service\s*charge|transaction\s*fee|transfer\s*fee|card\s*fee|atm\s*fee/i;

const MARKETING_MEDIA_PATTERN =
  /voice\s*over|studio|production|advertis|marketing|promo|facebook|google\s*ads|social\s*media|media\s*buy|branding|campaign|golf\s*shirt|projector|media\s*allowance|contingency|contigency|usd\s*for\s*facebook/i;

const TRAVEL_MEALS_PATTERN =
  /travel|transport|accommodation|entertainment|snack|meal|lunch|launch|refreshment|food\s*allowance|fuel|vehicle|parking|toll/i;

const LEGAL_PROFESSIONAL_PATTERN =
  /legal|lawyer|attorney|solicitor|notary|professional\s*fee|accounting\s*fee|audit|consulting\s*fee|statutory|compliance\s*fee|counsel/i;

const NON_SALARY_SIGNAL_PATTERN =
  /facebook|bank\s*charge|bank\s*service|golf\s*shirt|refreshment|snack|marketing|utilit|rent|software|communication|loan\s*repay|legal|professional|insurance|depreciat|office\s*suppl|stationery|overtime\s*allowance|executive\s*meeting|food\s*allowance|meal|lunch|launch|entertainment|travel|transport|fuel|vehicle|parking|advertis|promotion|projector|media\s*allowance|contingency|contigency|subscription|hosting|development/i;

const SALARY_SIGNAL_PATTERN =
  /payroll|salary|salaries|wages|net\s*pay|gross\s*pay|staff\s*pay|employee\s*pay|paye|pension\s*contribution|nps\s*contribution|salary\s*advance|staff\s*compensation|remuneration|admin\s*(?:&|and)\s*management\s*sal/i;

/**
 * @param {{
 *   category?: string|null,
 *   description?: string|null,
 *   notes?: string|null,
 *   isPayrollGl?: boolean,
 * }} input
 */
export function expenseLooksLikePayrollOrSalary(input) {
  if (input.isPayrollGl) return true;
  if (isPayrollDashboardMirrorExpense({ notes: input.notes, category: input.category })) {
    return true;
  }

  const combined = expenseTextBlob(input);

  if (NON_SALARY_SIGNAL_PATTERN.test(combined) && !SALARY_SIGNAL_PATTERN.test(combined)) {
    return false;
  }

  if (SALARY_SIGNAL_PATTERN.test(combined)) return true;

  const catCode = lookupStandardExpenseCodeFromCategorySync(input.category);
  if (catCode === CANONICAL_SALARY_ACCOUNT_CODE) return true;

  return false;
}

/**
 * @param {{ category?: string|null, description?: string|null, notes?: string|null }} input
 */
export function expenseTextBlob(input) {
  return `${input.category || ''} ${input.description || ''} ${input.notes || ''}`.toLowerCase();
}

/**
 * @param {{ category?: string|null, description?: string|null, notes?: string|null }} input
 */
export function expenseLooksLikeBankCharges(input) {
  return BANK_CHARGES_PATTERN.test(expenseTextBlob(input));
}

/**
 * @param {{ category?: string|null, description?: string|null, notes?: string|null }} input
 */
export function expenseLooksLikeTravelOrMeals(input) {
  if (expenseLooksLikeMarketingMedia(input)) return false;
  return TRAVEL_MEALS_PATTERN.test(expenseTextBlob(input));
}

/**
 * @param {{ category?: string|null, description?: string|null, notes?: string|null }} input
 */
export function expenseLooksLikeRentOrLease(input) {
  return RENT_LEASE_PATTERN.test(expenseTextBlob(input));
}

/**
 * @param {{ category?: string|null, description?: string|null, notes?: string|null }} input
 */
export function expenseLooksLikeItHostingOrSoftware(input) {
  return SOFTWARE_IT_HOSTING_PATTERN.test(expenseTextBlob(input));
}

/**
 * @param {{ category?: string|null, description?: string|null, notes?: string|null }} input
 */
export function expenseLooksLikeMarketingMedia(input) {
  return MARKETING_MEDIA_PATTERN.test(expenseTextBlob(input));
}

/**
 * @param {{ category?: string|null, description?: string|null, notes?: string|null }} input
 */
export function expenseLooksLikeLegalOrProfessional(input) {
  return LEGAL_PROFESSIONAL_PATTERN.test(expenseTextBlob(input));
}

/**
 * @param {{ category?: string|null, description?: string|null, notes?: string|null }} input
 */
export function expenseLooksLikeOvertimeAllowance(input) {
  if (expenseLooksLikeItHostingOrSoftware(input)) return false;
  return OVERTIME_ALLOWANCE_PATTERN.test(expenseTextBlob(input));
}

/**
 * Infer the correct operating expense account from transaction text alone.
 * @param {{ category?: string|null, description?: string|null, notes?: string|null }} content
 * @returns {{ accountCode: string, reason: string } | null}
 */
export function resolveContentBasedExpenseAccount(content) {
  if (expenseLooksLikeRentOrLease(content)) {
    return { accountCode: CANONICAL_RENT_LEASE_CODE, reason: 'rent-lease' };
  }
  if (expenseLooksLikeBankCharges(content)) {
    return { accountCode: CANONICAL_BANK_CHARGES_CODE, reason: 'bank-charges' };
  }
  if (expenseLooksLikeItHostingOrSoftware(content)) {
    return { accountCode: CANONICAL_IT_HOSTING_CODE, reason: 'it-hosting-software' };
  }
  if (expenseLooksLikeMarketingMedia(content)) {
    return { accountCode: CANONICAL_MARKETING_CODE, reason: 'marketing-media' };
  }
  if (expenseLooksLikeTravelOrMeals(content)) {
    return { accountCode: CANONICAL_TRAVEL_TRANSPORT_CODE, reason: 'travel-meals' };
  }
  if (expenseLooksLikeLegalOrProfessional(content)) {
    return { accountCode: CANONICAL_LEGAL_PROFESSIONAL_CODE, reason: 'legal-professional' };
  }

  for (const part of [content.category, content.description, content.notes]) {
    const sync = lookupStandardExpenseCodeFromCategorySync(part);
    if (sync && !isLegacySalaryBucketCode(sync)) {
      return { accountCode: sync, reason: 'category-sync' };
    }
  }

  return null;
}

/**
 * @param {string|null|undefined} accountCode
 * @param {{ category?: string|null, description?: string|null, notes?: string|null }} [content]
 * @returns {{ accountCode: string, remapped: boolean, reason?: string }}
 */
export function applyLegacyExpenseAccountCodeRemap(accountCode, content = {}) {
  const code = String(accountCode || '').trim();
  if (!code) return { accountCode: code, remapped: false };

  if (
    (DUPLICATE_OVERTIME_ALLOWANCE_CODES.has(code) || code === CANONICAL_OVERTIME_ALLOWANCE_CODE) &&
    expenseLooksLikeItHostingOrSoftware(content)
  ) {
    return {
      accountCode: CANONICAL_IT_HOSTING_CODE,
      remapped: true,
      reason: 'software-on-overtime-account',
    };
  }

  if (isLegacySalaryBucketCode(code)) {
    if (expenseLooksLikePayrollOrSalary(content)) {
      return {
        accountCode: CANONICAL_SALARY_ACCOUNT_CODE,
        remapped: code !== CANONICAL_SALARY_ACCOUNT_CODE,
        reason: 'salary-payroll',
      };
    }
    const salaryResolved = resolveContentBasedExpenseAccount(content);
    if (salaryResolved) {
      return {
        accountCode: salaryResolved.accountCode,
        remapped: true,
        reason: `misposted-on-${code}`,
      };
    }
    return { accountCode: code, remapped: false };
  }

  if (code === CANONICAL_SALARY_ACCOUNT_CODE && !expenseLooksLikePayrollOrSalary(content)) {
    const resolved = resolveContentBasedExpenseAccount(content);
    if (resolved) {
      return {
        accountCode: resolved.accountCode,
        remapped: true,
        reason: 'misposted-on-salary',
      };
    }
  }

  if (CONTENT_RECLASSIFY_ACCOUNT_CODES.has(code)) {
    const resolved = resolveContentBasedExpenseAccount(content);
    if (resolved && resolved.accountCode !== code) {
      return {
        accountCode: resolved.accountCode,
        remapped: true,
        reason: `misposted-on-${code}`,
      };
    }
  }

  const survivor = LEGACY_EXPENSE_ACCOUNT_MERGE_MAP[code];
  if (survivor && survivor !== code) {
    return { accountCode: survivor, remapped: true, reason: 'legacy-account-merge' };
  }

  return { accountCode: code, remapped: false };
}

/**
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db
 * @param {string} tenantId
 * @param {string} fromCode
 * @param {string} toCode
 */
async function mergeTenantAccountByCode(db, tenantId, fromCode, toCode) {
  const [fromAcc, toAcc] = await Promise.all([
    db.account.findFirst({
      where: { tenantId, accountCode: fromCode, accountType: 'Expense' },
      select: { id: true, mergedIntoAccountId: true },
    }),
    db.account.findFirst({
      where: { tenantId, accountCode: toCode, accountType: 'Expense' },
      select: { id: true },
    }),
  ]);

  if (!fromAcc || !toAcc || fromAcc.id === toAcc.id) return;

  if (fromAcc.mergedIntoAccountId !== toAcc.id) {
    await db.account.update({
      where: { id: fromAcc.id },
      data: {
        mergedIntoAccountId: toAcc.id,
        isActive: false,
        visibleInChart: false,
      },
    });
  }
}

/**
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db
 * @param {string} tenantId
 */
export async function ensureLegacyExpenseAccountMerges(db, tenantId) {
  if (!tenantId) return;

  for (const [fromCode, toCode] of Object.entries(LEGACY_EXPENSE_ACCOUNT_MERGE_MAP)) {
    await mergeTenantAccountByCode(db, tenantId, fromCode, toCode);
  }
}
