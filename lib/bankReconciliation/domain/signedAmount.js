/**
 * Bank-perspective signed amounts (minor units).
 * + = money in (credit on bank statement / debit on bank asset CoA)
 * - = money out (debit on bank statement / credit on bank asset CoA)
 */

import { parseDecimalToMinor, minorToDecimalString } from '../../accountingV2/domain/money.js';

export function toSignedMinor(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return parseDecimalToMinor(value.toFixed(2));
  }
  return parseDecimalToMinor(String(value).replace(/,/g, '').trim());
}

export function fromSignedMinor(minor) {
  return minorToDecimalString(Number(minor) || 0);
}

/** Normalize debit/credit columns into a single signed amount. */
export function signedFromDebitCredit({ debit, credit, amount }) {
  if (amount != null && String(amount).trim() !== '') {
    return toSignedMinor(amount);
  }
  const d = toSignedMinor(debit || 0);
  const c = toSignedMinor(credit || 0);
  // Bank statement: credit increases balance → positive
  return c - d;
}

/**
 * Normalize a GL bank asset line to bank-perspective signed minor.
 * Asset normal balance = debit. Debit increases cash → +.
 */
export function signedFromJournalLine({ debit, credit }) {
  const d = toSignedMinor(debit || 0);
  const c = toSignedMinor(credit || 0);
  return d - c;
}

export function normalizeReference(ref) {
  if (!ref) return null;
  return String(ref)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function daysBetween(a, b) {
  const ms = Math.abs(new Date(a).setHours(0, 0, 0, 0) - new Date(b).setHours(0, 0, 0, 0));
  return Math.round(ms / 86400000);
}
