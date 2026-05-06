import { describe, it, expect } from 'vitest';
import {
  accountBlocksDirectPosting,
  validateLineAccountsAllowDirectPosting,
  coaAccountDisplayLabel,
} from '../lib/coaDirectPostingEligibility.js';

describe('coaAccountDisplayLabel', () => {
  it('joins code and name', () => {
    expect(
      coaAccountDisplayLabel({ accountCode: '5100', accountName: 'COGS' }),
    ).toBe('5100 — COGS');
  });
});

describe('accountBlocksDirectPosting', () => {
  it('blocks structural root 5000', () => {
    const r = accountBlocksDirectPosting({
      id: 'a1',
      accountCode: '5000',
      accountName: 'Expenses',
      acceptsNewTransactions: false,
      _count: { childAccounts: 0 },
    });
    expect(r.blocked).toBe(true);
    expect(r.reason).toMatch(/Structural chart/);
  });

  it('blocks acceptsNewTransactions false', () => {
    const r = accountBlocksDirectPosting({
      id: 'a2',
      accountCode: '5999',
      accountName: 'Retired',
      acceptsNewTransactions: false,
      _count: { childAccounts: 0 },
    });
    expect(r.blocked).toBe(true);
    expect(r.reason).toMatch(/not open for new postings/);
  });

  it('blocks parent with active children', () => {
    const r = accountBlocksDirectPosting({
      id: 'a3',
      accountCode: '5200',
      accountName: 'Operating expenses',
      acceptsNewTransactions: true,
      _count: { childAccounts: 3 },
    });
    expect(r.blocked).toBe(true);
    expect(r.reason).toMatch(/consolidation parent/);
  });

  it('allows leaf with zero active children', () => {
    const r = accountBlocksDirectPosting({
      id: 'a4',
      accountCode: '5210',
      accountName: 'Office supplies',
      acceptsNewTransactions: true,
      _count: { childAccounts: 0 },
    });
    expect(r.blocked).toBe(false);
  });

  it('allows leaf when _count missing (unknown hierarchy)', () => {
    const r = accountBlocksDirectPosting({
      id: 'a5',
      accountCode: '5210',
      accountName: 'Office supplies',
      acceptsNewTransactions: true,
    });
    expect(r.blocked).toBe(false);
  });

  it('respects activeChildCount override when _count missing', () => {
    const r = accountBlocksDirectPosting(
      {
        id: 'a6',
        accountCode: '5200',
        accountName: 'Group',
        acceptsNewTransactions: true,
      },
      { activeChildCount: 1 },
    );
    expect(r.blocked).toBe(true);
  });
});

describe('validateLineAccountsAllowDirectPosting', () => {
  it('returns ok for all allowed accounts', () => {
    const r = validateLineAccountsAllowDirectPosting([
      { id: '1', accountCode: '5210', acceptsNewTransactions: true, _count: { childAccounts: 0 } },
      { id: '2', accountCode: '1111', acceptsNewTransactions: true, _count: { childAccounts: 0 } },
    ]);
    expect(r.ok).toBe(true);
  });

  it('fails on first blocked account', () => {
    const r = validateLineAccountsAllowDirectPosting([
      { id: '1', accountCode: '5210', acceptsNewTransactions: true, _count: { childAccounts: 0 } },
      { id: '2', accountCode: '5000', acceptsNewTransactions: false, _count: { childAccounts: 0 } },
    ]);
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });
});
