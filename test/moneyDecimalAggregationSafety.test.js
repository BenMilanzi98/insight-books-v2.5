import { describe, expect, it } from 'vitest';
import { addMoney, subtractMoney } from '../lib/money.js';

class DecimalLike {
  constructor(value) {
    this.value = value;
  }

  toString() {
    return String(this.value);
  }
}

describe('money decimal aggregation safety', () => {
  it('does not concatenate Decimal-like amounts when adding payments', () => {
    const paid = [
      new DecimalLike('700000.00'),
      new DecimalLike('700000.00'),
    ].reduce((sum, amount) => addMoney(sum, amount), 0);

    expect(paid).toBe(1400000);
    expect(String(paid)).not.toBe('0700000.00700000.00');
  });

  it('keeps outstanding balances numeric with Decimal-like totals', () => {
    const total = new DecimalLike('2000000.00');
    const paid = new DecimalLike('700000.00');

    expect(subtractMoney(total, paid)).toBe(1300000);
  });
});
