import { describe, it, expect } from 'vitest';
import {
  checkPaymentAccountFunds,
  formatPaymentAccountOptionLabel,
  getCashOutflowRequired,
} from '../../lib/paymentAccountFunds.js';

describe('paymentAccountFunds', () => {
  it('formats option labels with balance', () => {
    const label = formatPaymentAccountOptionLabel({
      reference: 'ACC-1',
      name: 'Main Bank',
      accountType: 'Bank',
      balance: 1200.5,
    });
    expect(label).toContain('ACC-1');
    expect(label).toContain('Main Bank');
    expect(label).toContain('1,200.50');
  });

  it('computes cash outflow for Fully paid / Partially / Pending', () => {
    expect(getCashOutflowRequired({ paymentStatus: 'Pending', amount: 100 })).toBe(0);
    expect(getCashOutflowRequired({ paymentStatus: 'Fully paid', amount: 100 })).toBe(100);
    expect(
      getCashOutflowRequired({ paymentStatus: 'Partially', amount: 100, paidAmount: 40 })
    ).toBe(40);
  });

  it('detects insufficient funds and shortfall', () => {
    const accounts = [{ id: 'pa1', name: 'Cash', balance: 50 }];
    const fail = checkPaymentAccountFunds({
      paymentAccounts: accounts,
      paymentAccountId: 'pa1',
      requiredAmount: 80,
    });
    expect(fail.ok).toBe(false);
    expect(fail.shortfall).toBe(30);

    const ok = checkPaymentAccountFunds({
      paymentAccounts: accounts,
      paymentAccountId: 'pa1',
      requiredAmount: 50,
    });
    expect(ok.ok).toBe(true);
  });
});
