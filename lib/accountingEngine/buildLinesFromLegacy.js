/**
 * Pure helpers to build TransactionLine payloads — patterns extracted from transactionJournalHelpers.
 */

import { roundMoney } from '../money.js';

/**
 * Standard two-line double-entry: debit one account, credit another for the same amount.
 */
export function buildTwoLineEntry(
  debitAccountId,
  creditAccountId,
  amount,
  debitDesc,
  creditDesc
) {
  const amt = roundMoney(amount);
  return [
    {
      lineNumber: 1,
      accountId: debitAccountId,
      debitAmount: amt,
      creditAmount: 0,
      description: debitDesc,
    },
    {
      lineNumber: 2,
      accountId: creditAccountId,
      debitAmount: 0,
      creditAmount: amt,
      description: creditDesc,
    },
  ];
}

/**
 * Sale revenue recognition with one or more payment debits and a single revenue credit.
 * Mirrors createSaleJournalEntries split-payment / single-payment line construction.
 *
 * @param {Array<{ accountId: string, amount: number }>} paymentLines
 * @param {string} revenueAccountId
 * @param {number} totalAmount
 * @param {string} saleNumber
 */
export function buildPaymentDebitLines(
  paymentLines,
  revenueAccountId,
  totalAmount,
  saleNumber
) {
  const total = roundMoney(totalAmount);
  return [
    ...paymentLines.map((line, i) => ({
      lineNumber: i + 1,
      accountId: line.accountId,
      debitAmount: roundMoney(line.amount),
      creditAmount: 0,
      description: `Payment received for sale ${saleNumber}`,
    })),
    {
      lineNumber: paymentLines.length + 1,
      accountId: revenueAccountId,
      debitAmount: 0,
      creditAmount: total,
      description: `Revenue from sale ${saleNumber}`,
    },
  ];
}
