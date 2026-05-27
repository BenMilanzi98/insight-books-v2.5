import { describe, expect, it } from 'vitest';
import {
  addMoney,
  compareMoney,
  moneyEquals,
  multiplyMoney,
  parseMoney,
  percentOfMoney,
  roundMoney,
  subtractMoney,
} from '../lib/money.js';

describe('money', () => {
  it('adds large decimals accurately', () => {
    expect(addMoney(10265.43, 152573.11)).toBe(162838.54);
  });

  it('rounds half-up to 2 dp', () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(1.004)).toBe(1.0);
  });

  it('parses comma-separated amounts', () => {
    expect(parseMoney('10,265.43')).toBe(10265.43);
  });

  it('subtracts without float drift', () => {
    expect(subtractMoney(0.3, 0.1)).toBe(0.2);
  });

  it('computes percent tax on net line', () => {
    expect(percentOfMoney(100, 16.5)).toBe(16.5);
  });

  it('multiplies quantity × price', () => {
    expect(multiplyMoney(3.5, 19.99)).toBe(69.97);
  });

  it('compares with tolerance', () => {
    expect(moneyEquals(10.0, 10.004)).toBe(true);
    expect(compareMoney(10.01, 10.0)).toBe(1);
  });
});
