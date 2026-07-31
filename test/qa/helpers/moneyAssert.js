/**
 * Exact-decimal assertions for Phase 16 — no floating-point authority.
 */

import { expect } from 'vitest';
import {
  parseToMinor,
  minorToDecimalString,
} from '../../../lib/financialPlanning/domain/money.js';

export { parseToMinor, minorToDecimalString };

export function expectMinorEqual(actual, expected, label = 'amount') {
  const a = typeof actual === 'bigint' ? actual : parseToMinor(actual);
  const e = typeof expected === 'bigint' ? expected : parseToMinor(expected);
  expect(a, `${label}: expected ${minorToDecimalString(e)} got ${minorToDecimalString(a)}`).toBe(e);
}

export function sumMinors(values = []) {
  return values.reduce((s, v) => s + parseToMinor(v), 0n);
}

export function expectBalancedDebitsCredits(debits, credits, label = 'journal') {
  const d = sumMinors(debits);
  const c = sumMinors(credits);
  expect(d, `${label}: debits ${minorToDecimalString(d)} != credits ${minorToDecimalString(c)}`).toBe(
    c
  );
}
