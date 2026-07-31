/**
 * CoA V2 — salary-account enforcement (Phase 3 §20).
 *
 * 5200 Salaries & Wages is the approved canonical salary expense account
 * (existing standard: `lib/salaryExpenseAccountCodes.js`). This service:
 *  - resolves future payroll/salary expense strictly to the SALARIES_AND_WAGES
 *    purpose mapping (registry) or canonical 5200 — explicit error when missing;
 *  - identifies conflicting salary-like accounts by CODE membership (the known
 *    legacy duplicate code families) — display-name checks are used only to FLAG
 *    candidates for human review, never to resolve postings;
 *  - never touches historical journal lines; conflicting accounts are queued for
 *    controlled deprecation (consolidation plans) and Phase 6 repair.
 *
 * Payroll liabilities (PAYE, pension, deductions) stay in liability accounts —
 * they resolve through their own purposes, never through 5200.
 */

import prisma from '../../prisma.js';
import {
  CANONICAL_SALARY_ACCOUNT_CODE,
  LEGACY_SALARY_BUCKET_CODES,
  normalizeSalaryAccountCode,
} from '../../salaryExpenseAccountCodes.js';
import { resolvePurposeAccount } from './accountMappingRegistry.js';
import { AccountLifecycleStatus } from '../domain/behaviours.js';

export const CANONICAL_SALARY_CODE = CANONICAL_SALARY_ACCOUNT_CODE;

/**
 * Is this account a known salary-duplicate (by legacy duplicate CODE)?
 * Code-based only — safe for automated exclusion from selectors.
 */
export function isConflictingSalaryAccount(account) {
  const code = normalizeSalaryAccountCode(account.accountCode ?? account.code);
  return LEGACY_SALARY_BUCKET_CODES.has(code);
}

/** Name patterns that FLAG (not resolve) salary-like accounts for review. */
const SALARY_NAME_PATTERN = /salar|wage|payroll|staff\s+cost|employee\s+cost/i;

/**
 * Resolve the account for salary expense postings. Registry purpose first;
 * explicit typed error when unconfigured (never a name search, never creation).
 * @param {import('../../accountingV2/domain/accountingContext.js').AccountingContext} context
 * @param {import('@prisma/client').PrismaClient} [db]
 */
export async function resolveSalaryExpenseAccount(context, db = prisma) {
  return resolvePurposeAccount(context, 'SALARIES_AND_WAGES', { module: 'PAYROLL' }, db);
}

/**
 * Audit every salary-like expense account for a business (Phase 3 §20 report).
 * Read-only: produces the classification rows for SALARY_ACCOUNT_CLEANUP_REPORT.
 *
 * @param {{businessId: string}} context
 * @param {import('@prisma/client').PrismaClient} [db]
 */
export async function auditSalaryAccounts(context, db = prisma) {
  const accounts = await db.account.findMany({
    where: { tenantId: context.businessId },
    select: {
      id: true, accountCode: true, code: true, accountName: true, name: true,
      accountType: true, type: true, parentAccountId: true, isActive: true,
      acceptsNewTransactions: true, coaV2Status: true, coaV2Category: true,
      systemPurpose: true, mergedIntoAccountId: true, replacementAccountId: true,
    },
  });

  const salaryLike = accounts.filter((a) => {
    const code = normalizeSalaryAccountCode(a.accountCode ?? a.code);
    const name = String(a.accountName ?? a.name ?? '');
    return code === CANONICAL_SALARY_CODE || LEGACY_SALARY_BUCKET_CODES.has(code) || SALARY_NAME_PATTERN.test(name);
  });

  const rows = [];
  for (const account of salaryLike) {
    const code = normalizeSalaryAccountCode(account.accountCode ?? account.code);
    const [txLines, jeLines, expenseUse, mappingUse] = await Promise.all([
      db.transactionLine.count({ where: { accountId: account.id } }),
      db.journalEntryLine.count({ where: { accountId: account.id } }),
      db.expense.count({ where: { expenseAccountId: account.id } }),
      db.coaV2AccountMapping.count({ where: { accountId: account.id, status: 'ACTIVE' } }),
    ]);
    const isCanonical = code === CANONICAL_SALARY_CODE;
    const isKnownDuplicate = LEGACY_SALARY_BUCKET_CODES.has(code);
    const legacyType = String(account.accountType ?? account.type ?? '').toLowerCase();
    const isExpenseTyped = legacyType === 'expense' || account.coaV2Category === 'EXPENSE';

    let proposedAction;
    if (isCanonical) proposedAction = 'KEEP_CANONICAL';
    else if (!isExpenseTyped) proposedAction = 'REVIEW_NOT_EXPENSE'; // liabilities named "Salary ..." stay liabilities
    else if (isKnownDuplicate && txLines + jeLines + expenseUse === 0) proposedAction = 'DEPRECATE_UNUSED';
    else if (isKnownDuplicate) proposedAction = 'CONSOLIDATE_WITH_PHASE6_REPAIR';
    else proposedAction = 'MANUAL_REVIEW';

    rows.push({
      accountId: account.id,
      code,
      name: account.accountName ?? account.name ?? '',
      legacyType: account.accountType ?? account.type ?? null,
      v2Category: account.coaV2Category ?? null,
      isActive: account.isActive !== false,
      acceptsNewTransactions: account.acceptsNewTransactions !== false,
      status: account.coaV2Status ?? AccountLifecycleStatus.ACTIVE,
      isCanonical,
      isKnownDuplicateCode: isKnownDuplicate,
      transactionLines: txLines,
      journalLines: jeLines,
      expenseReferences: expenseUse,
      activeMappings: mappingUse,
      mergedInto: account.mergedIntoAccountId ?? null,
      replacementAccountId: account.replacementAccountId ?? null,
      proposedAction,
      historicalRepairRequired: !isCanonical && isExpenseTyped && txLines + jeLines > 0,
    });
  }
  rows.sort((a, b) => a.code.localeCompare(b.code));
  return rows;
}
