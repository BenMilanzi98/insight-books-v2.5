/**
 * Expense.amount is stored as gross (total payable including any split tax component).
 * taxAmount is the tax portion when recorded separately — do not add to amount for total due.
 */
import { moneyEquals, moneyGreaterOrEqual, parseMoney, roundMoney, subtractMoney } from '@/lib/money';

export function getExpenseGrossAmount(expense) {
  return roundMoney(expense?.amount);
}

export function getExpenseOutstandingAmount(expense) {
  const gross = getExpenseGrossAmount(expense);
  const paid = roundMoney(expense?.paidAmount);
  return Math.max(0, subtractMoney(gross, paid));
}

export function isExpenseFullyPaid(expense) {
  return moneyGreaterOrEqual(parseMoney(expense?.paidAmount), getExpenseGrossAmount(expense));
}

export { moneyEquals as expensePaymentEquals };
