import { classifyCoaBucketByCode } from '@/lib/coaMigration/classifyRange.js';

/**
 * GL codes for the Expense Category picker & expenses flows — chart EXPENSES (5000) subtree plus:
 * **5700** (Custom Expenses header) and **5701–5899** (tenant-defined custom expense accounts).
 * Standard: 5100, 5110–5140, 5200, 5201–5203, 5210, 5300–5340, 5400, 5500, 5900.
 *
 * - `isTenantExpenseCategoryAccount` — any expense-type GL in COA bucket 5000–5999 (journals, flexibility).
 * - `isSystemExpenseStructurePickerAccount` — **only** the standard structure codes above (Expenses UI picker).
 */

export const SYSTEM_EXPENSE_STRUCTURE_CODES = new Set([
  '5100',
  '5110',
  '5120',
  '5130',
  '5140',
  '5200',
  '5201',
  '5202',
  '5203',
  '5210',
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
 * @param {{ requireNotMerged?: boolean }} [options] — default rejects merge-source rows (`mergedIntoAccountId` set)
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
 * True when this GL row may appear in Expenses “Expense category” and be saved on Expense rows.
 * Custom CoA codes in 5000–5999 outside {@link SYSTEM_EXPENSE_STRUCTURE_CODES} are excluded.
 */
export function isSystemExpenseStructurePickerAccount(account, options = {}) {
  if (!isTenantExpenseCategoryAccount(account, options)) return false;
  const code = account.accountCode ?? account.code ?? '';
  return isSystemExpenseStructureCode(code);
}
