import { describe, expect, it } from 'vitest';
import {
  splitTillFunding,
  buildOpenFundingLines,
  buildCloseSweepLines,
  posTillOpenSourceId,
  posTillCloseSourceId,
  POS_TILL_SOURCE,
  assertFundingSourcesAvailable,
} from '../lib/posTillFunding.js';

describe('splitTillFunding', () => {
  it('uses all cash when cash covers amount', () => {
    expect(splitTillFunding(500, 1000)).toEqual({ cashPart: 500, capitalPart: 0 });
  });

  it('uses all capital when cash is empty', () => {
    expect(splitTillFunding(500, 0)).toEqual({ cashPart: 0, capitalPart: 500 });
  });

  it('uses cash first then capital remainder', () => {
    expect(splitTillFunding(500, 200)).toEqual({ cashPart: 200, capitalPart: 300 });
  });

  it('treats negative cash as zero available', () => {
    expect(splitTillFunding(100, -50)).toEqual({ cashPart: 0, capitalPart: 100 });
  });

  it('returns zeros for zero/blank amounts', () => {
    expect(splitTillFunding(0, 999)).toEqual({ cashPart: 0, capitalPart: 0 });
  });
});

describe('journal builders', () => {
  it('builds one balanced multi-line open journal for cash+capital', () => {
    const { amount, lines } = buildOpenFundingLines({
      tillCoaId: 'till',
      cashCoaId: 'cash',
      capitalCoaId: 'cap',
      cashPart: 200,
      capitalPart: 300,
    });
    expect(amount).toBe(500);
    const debits = lines.reduce((s, l) => s + l.debitAmount, 0);
    const credits = lines.reduce((s, l) => s + l.creditAmount, 0);
    expect(debits).toBe(500);
    expect(credits).toBe(500);
    expect(lines.some((l) => l.accountId === 'till' && l.debitAmount === 500)).toBe(true);
    expect(lines.some((l) => l.accountId === 'cash' && l.creditAmount === 200)).toBe(true);
    expect(lines.some((l) => l.accountId === 'cap' && l.creditAmount === 300)).toBe(true);
  });

  it('builds cash-only open lines without capital', () => {
    const { lines } = buildOpenFundingLines({
      tillCoaId: 'till',
      cashCoaId: 'cash',
      capitalCoaId: null,
      cashPart: 100,
      capitalPart: 0,
    });
    expect(lines).toHaveLength(2);
  });

  it('builds close sweep Dr Cash Cr Till', () => {
    const { amount, lines } = buildCloseSweepLines({
      tillCoaId: 'till',
      cashCoaId: 'cash',
      amount: 400,
    });
    expect(amount).toBe(400);
    expect(lines.find((l) => l.accountId === 'cash').debitAmount).toBe(400);
    expect(lines.find((l) => l.accountId === 'till').creditAmount).toBe(400);
  });

  it('exports stable source ids and types', () => {
    expect(posTillOpenSourceId('d1', 2)).toBe('d1_open_2');
    expect(posTillCloseSourceId('d1', 2)).toBe('d1_close_2');
    expect(posTillOpenSourceId('d1', 2)).not.toContain(':');
    expect(posTillCloseSourceId('d1', 2)).not.toContain(':');
    expect(POS_TILL_SOURCE.OPEN).toBe('PosCashDayOpen');
    expect(POS_TILL_SOURCE.CLOSE).toBe('PosCashDayClose');
  });
});

describe('assertFundingSourcesAvailable', () => {
  it('does nothing when funding stays within cash', () => {
    expect(() =>
      assertFundingSourcesAvailable({ capitalPart: 0, capitalCoaId: null })
    ).not.toThrow();
  });

  it('throws CAPITAL_UNMAPPED when capital funding is required without a mapped account', () => {
    try {
      assertFundingSourcesAvailable({ capitalPart: 300, capitalCoaId: null });
      throw new Error('expected CAPITAL_UNMAPPED');
    } catch (error) {
      expect(error).toMatchObject({ code: 'CAPITAL_UNMAPPED' });
    }
  });
});
