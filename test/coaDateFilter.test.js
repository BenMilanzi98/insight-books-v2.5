import { describe, it, expect } from 'vitest';
import {
  accountClass,
  resolveCoaFilterBounds,
  journalLineMatchesCoaFilter,
  transactionDateMatchesCoaFilter,
} from '../lib/coaDateFilter.js';

describe('accountClass', () => {
  it('classifies balance sheet types', () => {
    expect(accountClass({ accountType: 'Asset' })).toBe('BS');
    expect(accountClass({ type: 'Liability' })).toBe('BS');
    expect(accountClass({ accountType: 'Equity' })).toBe('BS');
  });
  it('classifies income statement types', () => {
    expect(accountClass({ accountType: 'Revenue' })).toBe('IS');
    expect(accountClass({ type: 'Income' })).toBe('IS');
    expect(accountClass({ accountType: 'Expense' })).toBe('IS');
  });
  it('defaults non-GL types to BS', () => {
    expect(accountClass({ accountType: 'Other' })).toBe('BS');
  });
});

describe('resolveCoaFilterBounds', () => {
  it('returns no filter when range is empty', () => {
    const r = resolveCoaFilterBounds({ from: null, to: null, invalid: false }, 1);
    expect(r.hasFilter).toBe(false);
  });
  it('uses FY start when only dateTo is set (fiscal year July)', () => {
    const to = new Date(2024, 2, 15); // 15 Mar local
    const r = resolveCoaFilterBounds({ from: null, to, invalid: false }, 7);
    expect(r.hasFilter).toBe(true);
    expect(r.end?.getTime()).toBe(to.getTime());
    expect(r.effectiveFrom?.getMonth()).toBe(6); // July 0-based
    expect(r.effectiveFrom?.getFullYear()).toBe(2023);
  });
});

describe('journalLineMatchesCoaFilter', () => {
  const end = new Date('2024-06-30T23:59:59.999Z');
  const from = new Date('2024-01-01T00:00:00.000Z');
  const bounds = { hasFilter: true, end, effectiveFrom: from };

  it('BS: includes posting on or before dateTo even if before dateFrom', () => {
    const d = new Date('2020-01-01T00:00:00.000Z');
    expect(journalLineMatchesCoaFilter('BS', d, bounds)).toBe(true);
  });
  it('BS: excludes posting after dateTo', () => {
    const d = new Date('2025-01-01T00:00:00.000Z');
    expect(journalLineMatchesCoaFilter('BS', d, bounds)).toBe(false);
  });
  it('IS: includes only within [effectiveFrom, end]', () => {
    expect(journalLineMatchesCoaFilter('IS', new Date('2023-12-31T12:00:00Z'), bounds)).toBe(false);
    expect(journalLineMatchesCoaFilter('IS', new Date('2024-03-15T12:00:00Z'), bounds)).toBe(true);
    expect(journalLineMatchesCoaFilter('IS', new Date('2024-07-01T12:00:00Z'), bounds)).toBe(false);
  });
  it('all-time when hasFilter false', () => {
    const b = { hasFilter: false, end: null, effectiveFrom: null };
    expect(journalLineMatchesCoaFilter('BS', new Date('2099-01-01'), b)).toBe(true);
  });
});

describe('transactionDateMatchesCoaFilter', () => {
  const end = new Date('2024-06-30T23:59:59.999Z');
  const from = new Date('2024-01-01T00:00:00.000Z');
  const bounds = { hasFilter: true, end, effectiveFrom: from };

  it('mirrors journal BS / IS window semantics on Transaction.date', () => {
    expect(transactionDateMatchesCoaFilter('BS', new Date('2019-06-01'), bounds)).toBe(true);
    expect(transactionDateMatchesCoaFilter('BS', new Date('2025-06-01'), bounds)).toBe(false);
    expect(transactionDateMatchesCoaFilter('IS', new Date('2024-02-01'), bounds)).toBe(true);
    expect(transactionDateMatchesCoaFilter('IS', new Date('2023-02-01'), bounds)).toBe(false);
  });
});
