/**
 * Journal / posting invariant helpers (ACC-INV-*).
 */

import { expect } from 'vitest';
import { parseToMinor, expectMinorEqual, expectBalancedDebitsCredits } from './moneyAssert.js';

/**
 * Normalize line shapes from various engines:
 * { debit, credit } | { debitMinor, creditMinor } | { side, amount }
 */
export function normalizeLines(lines = []) {
  return lines.map((l, i) => {
    let debit = 0n;
    let credit = 0n;
    if (l.debitMinor != null || l.creditMinor != null) {
      debit = parseToMinor(l.debitMinor ?? 0);
      credit = parseToMinor(l.creditMinor ?? 0);
    } else if (l.debit != null || l.credit != null) {
      debit = parseToMinor(l.debit ?? 0);
      credit = parseToMinor(l.credit ?? 0);
    } else if (l.side && l.amount != null) {
      const amt = parseToMinor(l.amount);
      if (String(l.side).toUpperCase() === 'DEBIT') debit = amt;
      else credit = amt;
    } else if (l.amountMinor != null && l.entryType) {
      const amt = parseToMinor(l.amountMinor);
      if (String(l.entryType).toUpperCase().startsWith('D')) debit = amt;
      else credit = amt;
    }
    return {
      index: i,
      accountId: l.accountId || l.accountCode || l.account?.id || null,
      businessId: l.businessId || l.tenantId || null,
      debit,
      credit,
      raw: l,
    };
  });
}

/** ACC-INV-002 */
export function assertJournalBalances(lines, label = 'journal') {
  const norm = normalizeLines(lines);
  expect(norm.length, `${label}: need at least 2 lines`).toBeGreaterThanOrEqual(2);
  expectBalancedDebitsCredits(
    norm.map((l) => l.debit),
    norm.map((l) => l.credit),
    label
  );
  for (const l of norm) {
    expect(l.debit >= 0n && l.credit >= 0n, `${label} line ${l.index}: negative amount`).toBe(true);
    expect(
      !(l.debit > 0n && l.credit > 0n),
      `${label} line ${l.index}: both debit and credit non-zero`
    ).toBe(true);
  }
  return norm;
}

/** ACC-INV-006/007 — all lines same business */
export function assertSameBusiness(lines, businessId, label = 'journal') {
  const norm = normalizeLines(lines);
  for (const l of norm) {
    if (l.businessId == null) continue;
    expect(String(l.businessId), `${label} line ${l.index} business`).toBe(String(businessId));
  }
}

/** ACC-INV-019 — reversal is equal and opposite */
export function assertReversalOpposite(originalLines, reversalLines, label = 'reversal') {
  const o = normalizeLines(originalLines);
  const r = normalizeLines(reversalLines);
  expect(r.length, label).toBe(o.length);
  const oDebit = o.reduce((s, l) => s + l.debit, 0n);
  const oCredit = o.reduce((s, l) => s + l.credit, 0n);
  const rDebit = r.reduce((s, l) => s + l.debit, 0n);
  const rCredit = r.reduce((s, l) => s + l.credit, 0n);
  expectMinorEqual(rDebit, oCredit, `${label} debit`);
  expectMinorEqual(rCredit, oDebit, `${label} credit`);
}

/** ACC-INV-023 — Assets = Liabilities + Equity (minors) */
export function assertBalanceSheetEquation({ assets, liabilities, equity }, label = 'BS') {
  expectMinorEqual(
    parseToMinor(assets),
    parseToMinor(liabilities) + parseToMinor(equity),
    `${label} A = L + E`
  );
}

/** ACC-INV-047/048 — planning / proposed loan never posts */
export function assertNeverPostsToGl(payload, label = 'advisory') {
  expect(payload?.neverPostsToGl, `${label}.neverPostsToGl`).toBe(true);
  if (payload?.neverCreatesLiability != null) {
    expect(payload.neverCreatesLiability, `${label}.neverCreatesLiability`).toBe(true);
  }
}
