import { describe, it, expect } from 'vitest';
import {
  projectAccountBalanceAfterLine,
  accountMatchesJournalSearch,
  journalAccountOptionLabel,
} from '../lib/journalAccountSelect.js';

describe('projectAccountBalanceAfterLine', () => {
  it('handles debit-normal account', () => {
    const account = { currentBalance: 1400000, normalBalanceSide: 'Debit' };
    expect(projectAccountBalanceAfterLine(account, 100000, 0)).toBe(1500000);
    expect(projectAccountBalanceAfterLine(account, 0, 200000)).toBe(1200000);
  });

  it('handles credit-normal account', () => {
    const account = { currentBalance: 500000, normalBalanceSide: 'Credit' };
    expect(projectAccountBalanceAfterLine(account, 0, 100000)).toBe(600000);
    expect(projectAccountBalanceAfterLine(account, 50000, 0)).toBe(450000);
  });
});

describe('accountMatchesJournalSearch', () => {
  it('matches code and name fragments', () => {
    const account = { accountCode: '1540', accountName: 'Computer Equipment' };
    expect(accountMatchesJournalSearch(account, '1540')).toBe(true);
    expect(accountMatchesJournalSearch(account, 'computer')).toBe(true);
    expect(accountMatchesJournalSearch(account, '9999')).toBe(false);
  });
});

describe('journalAccountOptionLabel', () => {
  it('includes balance when formatter provided', () => {
    const account = {
      accountCode: '1540',
      accountName: 'Computer Equipment',
      currentBalance: 1400000,
    };
    const label = journalAccountOptionLabel(account, (n) => `MWK ${n}`);
    expect(label).toMatch(/1540 - Computer Equipment/);
    expect(label).toMatch(/MWK 1400000/);
  });
});
