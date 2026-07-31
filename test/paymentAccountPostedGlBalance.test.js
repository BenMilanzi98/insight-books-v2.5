import { describe, expect, it } from 'vitest';
import { balanceFromDebitCredit } from '../lib/paymentAccountPostedGlBalance.js';

describe('paymentAccountPostedGlBalance', () => {
  it('computes debit-normal asset balance (POS cash receipt)', () => {
    expect(
      balanceFromDebitCredit(5875, 0, { accountType: 'Asset', normalBalance: 'Debit' })
    ).toBe(5875);
  });

  it('nets credits against asset debit balance', () => {
    expect(
      balanceFromDebitCredit(10000, 2500, { accountType: 'Asset' })
    ).toBe(7500);
  });

  it('uses credit-normal for liability-style accounts', () => {
    expect(
      balanceFromDebitCredit(100, 500, { accountType: 'Liability', normalBalance: 'Credit' })
    ).toBe(400);
  });
});
