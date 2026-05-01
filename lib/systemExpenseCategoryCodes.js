import { classifyCoaBucketByCode } from '@/lib/coaMigration/classifyRange.js';

/**
 * GL codes allowed for /expenses category picker — matches `chart of accounts structure.txt`
 * EXPENSES (5000) subtree (lines 55–73): Cost of Sales, Salaries & Wages, operating leaves, catch-all 5900.
 *
 * For pickers and posting validation, use `isTenantExpenseCategoryAccount` so any CoA-created
 * account in the standard expense range (5000–5999) with type Expense is allowed — not only this Set.
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
  return SYSTEM_EXPENSE_STRUCTURE_CODES.has(n);
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
