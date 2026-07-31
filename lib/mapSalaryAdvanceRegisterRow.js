/**
 * Map a salary-advance record + receivable CoA account into a register row.
 */

import { salaryAdvanceReceivableCoaLabel } from './salaryAdvanceGlAccount.js';

/**
 * @param {object} advance
 * @param {{ id?: string, accountCode?: string, accountName?: string }|null} receivableAccount
 */
export function mapSalaryAdvanceToRegisterRow(advance, receivableAccount = null) {
  const accountCode = receivableAccount?.accountCode ?? null;
  return {
    id: advance.id,
    employeeName: advance.employee?.name ?? null,
    amount: advance.amount,
    advanceDate: advance.advanceDate,
    repaymentMonths: advance.repaymentMonths,
    reference: advance.reference ?? null,
    notes: advance.notes ?? null,
    outstandingAmount: advance.outstandingAmount,
    totalDeducted: advance.totalDeducted,
    accountCode,
    receivableAccountId: receivableAccount?.id ?? null,
    categoryLabel: receivableAccount
      ? salaryAdvanceReceivableCoaLabel(receivableAccount)
      : null,
  };
}
