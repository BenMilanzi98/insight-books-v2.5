/**
 * Resolve the CoA account used for P&L operating expense grouping and drill-down.
 * Reclassifies miscoded register rows on legacy duplicate 5200 to their true accounts.
 */

import { CHART_OF_ACCOUNTS_BLUEPRINT } from './chartOfAccountsBlueprint.js';
import {
  lookupStandardExpenseCodeFromCategorySync,
  getStandardExpenseAccountName,
} from './expenseCategoryNormalization.js';
import { inferOperatingExpenseRollupCodeFromText } from './incomeStatementOperatingExpenseRollup.js';
import {
  CANONICAL_SALARY_ACCOUNT_CODE,
  CANONICAL_SALARY_ACCOUNT_NAME,
  DUPLICATE_SALARY_ACCOUNT_CODE,
  isDuplicateSalaryAccountCode,
} from './salaryExpenseAccountCodes.js';
import {
  applyLegacyExpenseAccountCodeRemap,
  CANONICAL_EXPENSE_DISPLAY_NAMES,
  expenseLooksLikePayrollOrSalary,
} from './legacyExpenseAccountRemaps.js';

export { expenseLooksLikePayrollOrSalary };

/** @type {Map<string, string>} */
const BLUEPRINT_NAME_BY_CODE = new Map(
  CHART_OF_ACCOUNTS_BLUEPRINT.map((row) => [row.code, row.name])
);

/**
 * @param {...(string|null|undefined)} parts
 * @returns {string|null}
 */
export function inferOperatingExpenseCodeFromText(...parts) {
  for (const part of parts) {
    const text = String(part || '').trim();
    if (!text) continue;
    const sync = lookupStandardExpenseCodeFromCategorySync(text);
    if (sync && !isDuplicateSalaryAccountCode(sync)) return sync;
  }
  for (const part of parts) {
    const text = String(part || '').trim();
    if (!text) continue;
    const rolled = inferOperatingExpenseRollupCodeFromText(text);
    if (rolled && !isDuplicateSalaryAccountCode(rolled)) return rolled;
  }
  return null;
}

/**
 * @param {Map<string, string>} tenantNameByCode
 * @param {string} code
 */
function resolveAccountName(tenantNameByCode, code) {
  return (
    tenantNameByCode.get(code) ||
    BLUEPRINT_NAME_BY_CODE.get(code) ||
    getStandardExpenseAccountName(code) ||
    code
  );
}

/**
 * @param {{
 *   expenseAccount?: { id?: string|null, accountCode?: string|null, accountName?: string|null }|null,
 *   category?: string|null,
 *   description?: string|null,
 *   notes?: string|null,
 *   isPayrollGl?: boolean,
 *   tenantNameByCode?: Map<string, string>,
 * }} input
 */
export function resolveIncomeStatementExpenseAccountFields(input) {
  const tenantNameByCode = input.tenantNameByCode || new Map();
  const linked = input.expenseAccount;
  let accountCode = linked?.accountCode ? String(linked.accountCode).trim() : '';
  let accountName = linked?.accountName ? String(linked.accountName).trim() : '';
  let accountId = linked?.id ?? null;

  if (!accountCode && input.category) {
    const syncCode = lookupStandardExpenseCodeFromCategorySync(input.category);
    if (syncCode) {
      accountCode = syncCode;
      accountName = resolveAccountName(tenantNameByCode, syncCode);
      accountId = null;
    } else {
      accountCode = `cat:${input.category}`;
      accountName = input.category;
      accountId = null;
    }
  }

  const legacyRemap = applyLegacyExpenseAccountCodeRemap(accountCode, {
    category: input.category,
    description: input.description,
    notes: input.notes,
    isPayrollGl: input.isPayrollGl,
  });
  if (legacyRemap.remapped) {
    accountCode = legacyRemap.accountCode;
    accountName =
      resolveAccountName(tenantNameByCode, accountCode) ||
      CANONICAL_EXPENSE_DISPLAY_NAMES[accountCode] ||
      accountName;
    accountId = null;
  }

  return { accountCode, accountName, accountId };
}

/**
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} db
 * @param {string} tenantId
 */
export async function ensureDuplicate5301MergedInto5200(db, tenantId) {
  if (!tenantId) return;

  let acc5200 = await db.account.findFirst({
    where: { tenantId, accountCode: CANONICAL_SALARY_ACCOUNT_CODE, accountType: 'Expense' },
    select: { id: true },
  });

  if (!acc5200) {
    const parent5000 = await db.account.findFirst({
      where: { tenantId, accountCode: '5000' },
      select: { id: true },
    });
    acc5200 = await db.account.create({
      data: {
        tenantId,
        accountCode: CANONICAL_SALARY_ACCOUNT_CODE,
        code: CANONICAL_SALARY_ACCOUNT_CODE,
        accountName: CANONICAL_SALARY_ACCOUNT_NAME,
        name: CANONICAL_SALARY_ACCOUNT_NAME,
        accountType: 'Expense',
        type: 'Expense',
        accountSubtype: 'Operating Expense',
        normalBalance: 'Debit',
        parentAccountId: parent5000?.id ?? null,
        isActive: true,
        isSystem: true,
        balance: 0,
      },
      select: { id: true },
    });
  } else {
    await db.account.update({
      where: { id: acc5200.id },
      data: {
        accountName: CANONICAL_SALARY_ACCOUNT_NAME,
        name: CANONICAL_SALARY_ACCOUNT_NAME,
        mergedIntoAccountId: null,
        isActive: true,
        visibleInChart: true,
      },
    });
  }

  const acc5301 = await db.account.findFirst({
    where: { tenantId, accountCode: DUPLICATE_SALARY_ACCOUNT_CODE, accountType: 'Expense' },
    select: { id: true, mergedIntoAccountId: true },
  });

  if (!acc5301 || acc5301.id === acc5200.id) return;

  if (acc5301.mergedIntoAccountId !== acc5200.id) {
    await db.account.update({
      where: { id: acc5301.id },
      data: {
        mergedIntoAccountId: acc5200.id,
        isActive: false,
        visibleInChart: false,
      },
    });
  }
}

/** @deprecated Use ensureDuplicate5301MergedInto5200 */
export async function ensureDuplicate5200MergedInto5301(db, tenantId) {
  return ensureDuplicate5301MergedInto5200(db, tenantId);
}
