/**
 * Reconciliation calculation — no plug journals.
 *
 * statementClosing ≈ bookBalance + depositsInTransit − outstandingPayments + adjustments
 * (all in bank-perspective signed minor units where deposits are +, payments outstanding are −)
 */

import { fromSignedMinor } from './signedAmount.js';

/**
 * @param {object} input
 * @param {number} input.statementClosingMinor
 * @param {number} input.bookBalanceMinor — GL balance as of statement date
 * @param {number} input.depositsInTransitMinor — book deposits not yet on statement (+)
 * @param {number} input.outstandingPaymentsMinor — book payments not yet cleared (store as positive magnitude; applied as −)
 * @param {number} input.adjustmentsMinor — net adjustments already in book or pending (+/−)
 * @param {number} [input.toleranceMinor=0]
 */
export function calculateReconciliation(input) {
  const statementClosingMinor = Number(input.statementClosingMinor) || 0;
  const bookBalanceMinor = Number(input.bookBalanceMinor) || 0;
  const depositsInTransitMinor = Number(input.depositsInTransitMinor) || 0;
  const outstandingPaymentsMinor = Math.abs(Number(input.outstandingPaymentsMinor) || 0);
  const adjustmentsMinor = Number(input.adjustmentsMinor) || 0;
  const toleranceMinor = Math.abs(Number(input.toleranceMinor) || 0);

  // Adjusted book: start from book, add uncleared deposits, subtract uncleared payments, add adj
  const adjustedBookMinor =
    bookBalanceMinor + depositsInTransitMinor - outstandingPaymentsMinor + adjustmentsMinor;

  const differenceMinor = statementClosingMinor - adjustedBookMinor;
  const withinTolerance = Math.abs(differenceMinor) <= toleranceMinor;

  return {
    statementClosingMinor,
    bookBalanceMinor,
    depositsInTransitMinor,
    outstandingPaymentsMinor,
    adjustmentsMinor,
    adjustedBookMinor,
    differenceMinor,
    withinTolerance,
    canComplete: withinTolerance,
    decimals: {
      statementClosing: fromSignedMinor(statementClosingMinor),
      bookBalance: fromSignedMinor(bookBalanceMinor),
      depositsInTransit: fromSignedMinor(depositsInTransitMinor),
      outstandingPayments: fromSignedMinor(outstandingPaymentsMinor),
      adjustments: fromSignedMinor(adjustmentsMinor),
      adjustedBook: fromSignedMinor(adjustedBookMinor),
      difference: fromSignedMinor(differenceMinor),
    },
  };
}

export function progressPercent({ matchedCount, totalCount }) {
  const total = Number(totalCount) || 0;
  if (total <= 0) return 100;
  const matched = Number(matchedCount) || 0;
  return Math.min(100, Math.round((matched / total) * 100));
}
