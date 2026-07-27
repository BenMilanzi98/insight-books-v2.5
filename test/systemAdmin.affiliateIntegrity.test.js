import { describe, it, expect } from 'vitest';
import {
  assertUniqueReferralCode,
  commissionIdempotencyKey,
  payoutIdempotencyKey,
} from '@/lib/admin/affiliateIntegrity';

describe('affiliateIntegrity', () => {
  it('assertUniqueReferralCode normalizes and accepts unique codes', () => {
    expect(assertUniqueReferralCode('ab12cd', ['OTHER'])).toBe('AB12CD');
  });

  it('assertUniqueReferralCode throws on duplicates (case-insensitive)', () => {
    expect(() => assertUniqueReferralCode('Ab12', ['xx', 'AB12'])).toThrow(
      /already exists/i
    );
  });

  it('assertUniqueReferralCode rejects empty codes', () => {
    expect(() => assertUniqueReferralCode('')).toThrow(/required/i);
    expect(() => assertUniqueReferralCode(null)).toThrow(/required/i);
  });

  it('commissionIdempotencyKey is stable and scoped', () => {
    expect(commissionIdempotencyKey('t1', 'pay_9')).toBe('aff-comm:t1:pay_9');
    expect(commissionIdempotencyKey('t1', 'pay_9')).toBe(
      commissionIdempotencyKey('t1', 'pay_9')
    );
    expect(commissionIdempotencyKey('t1', 'pay_9')).not.toBe(
      commissionIdempotencyKey('t2', 'pay_9')
    );
  });

  it('commissionIdempotencyKey requires both ids', () => {
    expect(() => commissionIdempotencyKey('', 'p')).toThrow();
    expect(() => commissionIdempotencyKey('t', '')).toThrow();
  });

  it('payoutIdempotencyKey is stable per affiliate period', () => {
    expect(payoutIdempotencyKey('aff1', '2026-07')).toBe('aff-payout:aff1:2026-07');
    expect(payoutIdempotencyKey('aff1', '2026-07')).not.toBe(
      payoutIdempotencyKey('aff1', '2026-08')
    );
  });
});
