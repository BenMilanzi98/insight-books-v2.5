import { classifyCoaBucketByCode } from '@/lib/coaMigration/classifyRange.js';

/**
 * Helpers for expense-category/expense-account compatibility.
 *
 * - `isTenantExpenseCategoryAccount`: any expense-type GL in the 5000-5999 CoA expense bucket.
 * - `isSystemExpenseStructurePickerAccount`: legacy name kept for callers/tests; now follows the
 *   tenant CoA source of truth instead of limiting the picker to hard-coded system codes.
 */

export const SYSTEM_EXPENSE_STRUCTURE_CODES = new Set([
  '5100',
  '5110',
  '5120',
  '5130',
  '5140',
  '5200',
  '5300',
  '5310',
  '5320',
  '5330',
  '5340',
  '5400',
  '5500',
  '5700',
  '5900',
]);

/** @param {string|null|undefined} c */
export function normExpenseCategoryCode(c) {
  return String(c ?? '')
    .trim()
    .replace(/\s+/g, '');
}

/** @param {string|null|undefined} c */
export function isSystemExpenseStructureCode(c) {
  const n = normExpenseCategoryCode(c);
  if (SYSTEM_EXPENSE_STRUCTURE_CODES.has(n)) return true;
  if (/^\d{4}$/.test(n)) {
    const x = parseInt(n, 10);
    if (x >= 5701 && x <= 5899) return true;
  }
  return false;
}

/**
 * True when the row is a valid expense GL for the tenant (chart + expenses module).
 * @param {Record<string, unknown>|null|undefined} account
 * @param {{ requireNotMerged?: boolean }} [options] default rejects merge-source rows (`mergedIntoAccountId` set)
 */
export function isTenantExpenseCategoryAccount(account, options = {}) {
  if (!account || typeof account !== 'object') return false;
  const requireNotMerged = options.requireNotMerged !== false;
  if (requireNotMerged && account.mergedIntoAccountId) return false;
  const t = String(account.accountType ?? account.type ?? '')
    .trim()
    .toLowerCase();
  if (t !== 'expense') return false;
  const code = account.accountCode ?? account.code ?? '';
  return classifyCoaBucketByCode(code) === 'Expense';
}

/**
 * True when this GL row may appear in Expenses "Expense category" and be saved on Expense rows.
 * Includes all tenant CoA expense accounts in 5000-5999, not only the historical system-code list.
 */
export function isSystemExpenseStructurePickerAccount(account, options = {}) {
  return isTenantExpenseCategoryAccount(account, options);
}
