import { describe, it, expect } from 'vitest';
import {
  displayNaturalAccountBalance,
  displayTaxPaidAmount,
  isCreditNormalDisplayAccount,
  isTaxOutflowGlCode,
} from '../lib/coaMoney.js';
import { buildOpeningBalanceLines } from '../lib/postingRules/openingBalancePostingRules.js';
import { mergeSkipAllSteps } from '../lib/setupWizardService.js';

describe('mergeSkipAllSteps', () => {
  it('marks pending steps as skipped', () => {
    const result = mergeSkipAllSteps({ completed: {}, skipped: {} }, ['capital', 'taxes']);
    expect(result.skipped.capital).toBeTruthy();
    expect(result.skipped.taxes).toBeTruthy();
    expect(result.completed.capital).toBeUndefined();
  });

  it('ignores unknown step ids', () => {
    const result = mergeSkipAllSteps({}, ['not-a-real-step']);
    expect(Object.keys(result.skipped)).toHaveLength(0);
  });
});

describe('displayNaturalAccountBalance', () => {
  it('never shows negative liability balances', () => {
    const liability = { accountType: 'Liability', normalBalance: 'Credit' };
    expect(displayNaturalAccountBalance(liability, -50000)).toBe(0);
    expect(displayNaturalAccountBalance(liability, 50000)).toBe(50000);
  });

  it('never shows negative equity balances', () => {
    const equity = { accountType: 'Equity' };
    expect(displayNaturalAccountBalance(equity, -1000)).toBe(0);
  });

  it('shows tax outflow as positive magnitude', () => {
    const acct = { accountType: 'Expense', accountCode: '2045-01' };
    expect(displayNaturalAccountBalance(acct, -2500)).toBe(2500);
    expect(isTaxOutflowGlCode('2045-01')).toBe(true);
  });

  it('allows asset balances to remain signed', () => {
    const asset = { accountType: 'Asset' };
    expect(displayNaturalAccountBalance(asset, -100)).toBe(-100);
  });
});

describe('displayTaxPaidAmount', () => {
  it('returns non-negative absolute value', () => {
    expect(displayTaxPaidAmount(-662.5)).toBe(662.5);
    expect(displayTaxPaidAmount(662.5)).toBe(662.5);
    expect(displayTaxPaidAmount(0)).toBe(0);
  });
});

describe('buildOpeningBalanceLines', () => {
  const equity = { id: 'eq-1', accountName: 'Opening Balance Equity' };
  const inventory = { id: 'inv-1', accountName: 'Stock on Hand' };
  const payable = { id: 'ap-1', accountName: 'Accounts Payable' };

  it('posts opening stock Dr inventory / Cr equity', () => {
    const lines = buildOpeningBalanceLines('opening_stock', {
      targetAccount: inventory,
      equityAccount: equity,
      amount: 2_000_000,
    });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ accountId: 'inv-1', debitAmount: 2_000_000, creditAmount: 0 });
    expect(lines[1]).toMatchObject({ accountId: 'eq-1', debitAmount: 0, creditAmount: 2_000_000 });
  });

  it('posts opening payable Dr equity / Cr payable', () => {
    const lines = buildOpeningBalanceLines('opening_payable', {
      targetAccount: payable,
      equityAccount: equity,
      amount: 500_000,
    });
    expect(lines[0]).toMatchObject({ accountId: 'eq-1', debitAmount: 500_000 });
    expect(lines[1]).toMatchObject({ accountId: 'ap-1', creditAmount: 500_000 });
  });

  it('rejects zero amount', () => {
    expect(() =>
      buildOpeningBalanceLines('opening_stock', {
        targetAccount: inventory,
        equityAccount: equity,
        amount: 0,
      }),
    ).toThrow(/greater than zero/);
  });
});

describe('isCreditNormalDisplayAccount', () => {
  it('identifies liability accounts', () => {
    expect(isCreditNormalDisplayAccount({ accountType: 'Liability' })).toBe(true);
    expect(isCreditNormalDisplayAccount({ accountType: 'Asset' })).toBe(false);
  });
});
