import { describe, expect, it } from 'vitest';
import { evaluateDesktopLock, LOCK_MS, WARN_MS } from '../../lib/desktop/lock.js';

const HOUR = 60 * 60 * 1000;
const t0 = Date.parse('2026-08-15T10:00:00.000Z');

describe('evaluateDesktopLock', () => {
  it('is unlocked under 20h', () => {
    const r = evaluateDesktopLock({
      lastSuccessfulSyncAt: t0,
      lastLocalNow: t0,
      now: t0 + 19 * HOUR,
      subscriptionActive: true,
    });
    expect(r.locked).toBe(false);
    expect(r.warning).toBe(false);
    expect(r.reason).toBeNull();
  });

  it('warns between 20h and 24h', () => {
    const r = evaluateDesktopLock({
      lastSuccessfulSyncAt: t0,
      lastLocalNow: t0,
      now: t0 + 21 * HOUR,
      subscriptionActive: true,
    });
    expect(r.locked).toBe(false);
    expect(r.warning).toBe(true);
    expect(r.hoursSinceSync).toBeGreaterThanOrEqual(20);
  });

  it('locks at 24h', () => {
    const r = evaluateDesktopLock({
      lastSuccessfulSyncAt: t0,
      lastLocalNow: t0,
      now: t0 + LOCK_MS,
      subscriptionActive: true,
    });
    expect(r.locked).toBe(true);
    expect(r.reason).toBe('stale');
  });

  it('locks when local clock moves backward more than 5 minutes', () => {
    const r = evaluateDesktopLock({
      lastSuccessfulSyncAt: t0,
      lastLocalNow: t0 + 2 * HOUR,
      now: t0 + 2 * HOUR - 6 * 60 * 1000,
      subscriptionActive: true,
    });
    expect(r.locked).toBe(true);
    expect(r.reason).toBe('clock');
  });

  it('does not lock for a 4-minute backward blip', () => {
    const r = evaluateDesktopLock({
      lastSuccessfulSyncAt: t0,
      lastLocalNow: t0 + HOUR,
      now: t0 + HOUR - 4 * 60 * 1000,
      subscriptionActive: true,
    });
    expect(r.reason).not.toBe('clock');
  });

  it('locks when subscription is inactive', () => {
    const r = evaluateDesktopLock({
      lastSuccessfulSyncAt: t0,
      lastLocalNow: t0,
      now: t0 + HOUR,
      subscriptionActive: false,
    });
    expect(r.locked).toBe(true);
    expect(r.reason).toBe('subscription');
  });
});
