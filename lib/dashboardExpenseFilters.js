/**
 * Dashboard "expense" totals should reflect cash/settled payables only.
 * Pending statutory liabilities (e.g. PAYE awaiting remittance) must not inflate totals.
 *
 * Uses case-insensitive paymentStatus so mixed DB casing cannot let pure Pending rows through.
 */
import { PAYROLL_DASHBOARD_EXPENSE_PREFIX } from './incomeStatementExpenseDedup.js';

export function settledExpensePaymentOr() {
  return {
    OR: [
      { paidAmount: { gt: 0 } },
      { paymentStatus: { equals: 'Fully paid', mode: 'insensitive' } },
      { paymentStatus: { equals: 'Partially', mode: 'insensitive' } },
      { paymentStatus: { equals: 'Partially paid', mode: 'insensitive' } },
    ],
  };
}

/** Exclude payroll mirror rows already represented in payroll GL. */
export function excludePayrollDashboardMirrorExpenses() {
  return {
    NOT: {
      notes: { contains: PAYROLL_DASHBOARD_EXPENSE_PREFIX },
    },
  };
}
