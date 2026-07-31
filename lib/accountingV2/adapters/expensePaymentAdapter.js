/**
 * Expense payment posting — settles AP / employee payable / credit card.
 * Must NOT re-debit the expense account when recognition already posted.
 */

import { AccountingEventType, AccountingSourceModule } from '../domain/enums.js';
import { amountString, contextFromSession, submitViaCutover, toIsoDate } from './baseAdapter.js';
import { getPaymentAccount } from '../../transactionJournalHelpers.js';
import { findAccountsPayableGlAccount } from '../../coaPostingCodes.js';
import { resolvePurposeAccount } from '../../coaV2/application/accountMappingRegistry.js';

export async function postExpensePaymentAccounting({
  db,
  tenantId,
  userId,
  paymentId,
  expense,
  paymentAmount,
  paymentDate,
  paymentMethod,
  hasPermission = () => true,
  currency = 'MWK',
}) {
  const context = contextFromSession({
    tenantId,
    userId,
    currency,
    branchId: expense?.branchId ?? null,
  });

  return submitViaCutover({
    db,
    context,
    moduleKey: AccountingSourceModule.EXPENSES,
    eventType: AccountingEventType.EXPENSE_PAYMENT_POSTED,
    hasPermission,
    buildEngineInput: async () => {
      const cash = await getPaymentAccount(tenantId, paymentMethod, db);
      if (!cash?.id) {
        throw new Error('Payment account (cash/bank) not found for expense payment.');
      }

      let debitAccountId = null;
      let debitDescription = 'Expense payment settlement';

      if (expense.supplierId) {
        const ap = await findAccountsPayableGlAccount(tenantId, db);
        if (!ap?.id) throw new Error('Accounts Payable account not found.');
        debitAccountId = ap.id;
        debitDescription = 'Accounts Payable — expense payment';
      } else if (expense.settlementType === 'EMPLOYEE' || expense.employeeId) {
        try {
          const emp = await resolvePurposeAccount({
            db,
            context,
            purpose: 'EMPLOYEE_PAYABLES',
          });
          debitAccountId = emp?.accountId || emp?.id;
        } catch {
          const row = await db.account.findFirst({
            where: { tenantId, accountCode: '2170', isActive: true },
          });
          debitAccountId = row?.id;
        }
        debitDescription = 'Employee Payables — reimbursement';
      } else if (expense.settlementType === 'CREDIT_CARD') {
        try {
          const cc = await resolvePurposeAccount({
            db,
            context,
            purpose: 'CREDIT_CARD_PAYABLE',
          });
          debitAccountId = cc?.accountId || cc?.id;
        } catch {
          const row = await db.account.findFirst({
            where: { tenantId, accountCode: '2180', isActive: true },
          });
          debitAccountId = row?.id;
        }
        debitDescription = 'Credit Card Payable — expense payment';
      } else {
        // Cash/bank expense recognition already credited cash — payment row is operational only.
        const err = new Error(
          'Expense payment GL skipped: cash/bank expense recognition already settled the cash credit. Payment recorded without a second journal.'
        );
        err.code = 'EXPENSE_PAYMENT_NO_ADDITIONAL_GL';
        throw err;
      }

      if (!debitAccountId) {
        throw new Error('Could not resolve liability account for expense payment.');
      }

      return {
        sourceReference: {
          sourceModule: AccountingSourceModule.EXPENSES,
          sourceType: 'ExpensePayment',
          sourceId: paymentId,
          sourceNumber: expense.expenseNumber || expense.id,
          eventType: AccountingEventType.EXPENSE_PAYMENT_POSTED,
        },
        transactionDate: toIsoDate(paymentDate),
        requestedPostingDate: toIsoDate(paymentDate),
        currency,
        totalAmount: amountString(paymentAmount),
        taxAmount: '0.00',
        description: `Expense payment — ${expense.description || expense.id}`,
        dimensions: {
          supplierId: expense.supplierId ?? undefined,
          branchId: expense.branchId ?? undefined,
        },
        metadata: {
          expenseId: expense.id,
          cashAccountId: cash.id,
          debitAccountId,
          debitDescription,
          lines: [
            {
              lineNumber: 1,
              accountId: debitAccountId,
              debitAmount: paymentAmount,
              creditAmount: 0,
              description: debitDescription,
            },
            {
              lineNumber: 2,
              accountId: cash.id,
              debitAmount: 0,
              creditAmount: paymentAmount,
              description: `Payment via ${paymentMethod}`,
            },
          ],
        },
        payload: null,
      };
    },
  });
}
