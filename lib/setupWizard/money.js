/** Exact money helpers for setup (2dp minor units). */
import { parseToMinor, minorToDecimalString } from '../financialPlanning/domain/money.js';

export { parseToMinor, minorToDecimalString };

/**
 * Normalize a line to exclusive debit OR credit (not both).
 * @param {unknown} debit
 * @param {unknown} credit
 * @returns {{ debit: string|null, credit: string|null, debitMinor: bigint, creditMinor: bigint }}
 */
export function normalizeDebitCredit(debit, credit) {
  let debitMinor = parseToMinor(debit || 0);
  let creditMinor = parseToMinor(credit || 0);
  if (debitMinor < 0n) {
    creditMinor += -debitMinor;
    debitMinor = 0n;
  }
  if (creditMinor < 0n) {
    debitMinor += -creditMinor;
    creditMinor = 0n;
  }
  if (debitMinor > 0n && creditMinor > 0n) {
    if (debitMinor >= creditMinor) {
      debitMinor -= creditMinor;
      creditMinor = 0n;
    } else {
      creditMinor -= debitMinor;
      debitMinor = 0n;
    }
  }
  return {
    debit: debitMinor > 0n ? minorToDecimalString(debitMinor) : null,
    credit: creditMinor > 0n ? minorToDecimalString(creditMinor) : null,
    debitMinor,
    creditMinor,
  };
}

/**
 * @param {Array<{ debitMinor?: bigint, creditMinor?: bigint }>} lines
 */
export function sumDebitCredit(lines) {
  let debit = 0n;
  let credit = 0n;
  for (const line of lines) {
    debit += line.debitMinor || 0n;
    credit += line.creditMinor || 0n;
  }
  return {
    debitMinor: debit,
    creditMinor: credit,
    debit: minorToDecimalString(debit),
    credit: minorToDecimalString(credit),
    differenceMinor: debit - credit,
    difference: minorToDecimalString(debit - credit),
    balanced: debit === credit,
  };
}
