/**
 * Exclude expense-register rows from P&L operating expenses when the same economic
 * event is already captured in payroll GL or COGS GL.
 */

import {
  expenseOverlapsGlCogsForDedup,
  isGlCogsWindowActive,
} from './expenseRegisterGlCogsOverlap.js';

export const PAYROLL_DASHBOARD_EXPENSE_PREFIX = 'payrollDashboardExpense:';

/** @param {{ notes?: string|null, originalReference?: string|null, category?: string|null }} expense */
export function isPayrollDashboardMirrorExpense(expense) {
  const notes = String(expense?.notes || '');
  if (notes.includes(PAYROLL_DASHBOARD_EXPENSE_PREFIX)) return true;
  return false;
}

/**
 * @param {Array<Record<string, unknown>>} expenses
 * @param {{ cogsAccountIds?: string[], glCogsTotal?: number, glCogsLineCount?: number }} [opts]
 */
export function filterExpensesForIncomeStatementOperating(expenses, opts = {}) {
  const cogsAccountIds = opts.cogsAccountIds || [];
  const glActive = isGlCogsWindowActive(
    opts.glCogsTotal ?? 0,
    opts.glCogsLineCount ?? 0
  );
  const cogsIdSet = new Set(cogsAccountIds);

  return (expenses || []).filter((expense) => {
    if (isPayrollDashboardMirrorExpense(expense)) return false;
    if (expenseOverlapsGlCogsForDedup(expense, cogsIdSet, glActive)) return false;
    return true;
  });
}
