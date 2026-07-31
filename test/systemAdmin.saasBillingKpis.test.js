import { describe, it, expect } from 'vitest';
import {
  normalizeAmountToMrr,
  activePaidSubscriptionWhere,
} from '@/lib/admin/saasBillingKpis';
import { calculateMRR, getSubscriptionPlan } from '@/lib/subscriptionConfig';

describe('saasBillingKpis', () => {
  it('getSubscriptionPlan resolves by plan id string', () => {
    expect(getSubscriptionPlan('1year').id).toBe('1year');
    expect(getSubscriptionPlan('eis-monthly').id).toBe('eis-monthly');
  });

  it('calculateMRR works for plan ids (not only object keys)', () => {
    expect(calculateMRR('1month')).toBe(50000);
    expect(calculateMRR('1year')).toBe(Math.round(300000 / 12));
  });

  it('normalizeAmountToMrr divides yearly amounts', () => {
    expect(normalizeAmountToMrr(300000, '1year')).toBe(25000);
    expect(normalizeAmountToMrr(50000, '1month')).toBe(50000);
  });

  it('activePaidSubscriptionWhere requires isActive and future expiresAt', () => {
    const where = activePaidSubscriptionWhere(new Date('2026-07-28T00:00:00Z'));
    expect(where.isActive).toBe(true);
    expect(where.isTrial).toBe(false);
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
    expect(where.status.notIn).toContain('pending');
    expect(where.status.notIn).not.toContain('Completed');
  });
});
