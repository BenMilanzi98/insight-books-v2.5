import { describe, it, expect } from 'vitest';
import { normalizePayrollMonthPeriod } from '../lib/dateUtils.js';

describe('normalizePayrollMonthPeriod', () => {
  it('September 2026 ends on 30 Sept (UTC civil), not October', () => {
    const { periodStart, periodEnd } = normalizePayrollMonthPeriod('2026-09-01', '2026-09-30');
    expect(periodStart.toISOString().startsWith('2026-09-01')).toBe(true);
    expect(periodEnd.getUTCMonth()).toBe(8); // September 0-indexed
    expect(periodEnd.getUTCDate()).toBe(30);
  });

  it('reads YMD prefix from ISO strings', () => {
    const { periodEnd } = normalizePayrollMonthPeriod('2026-09-15T12:00:00.000Z', 'ignored');
    expect(periodEnd.getUTCMonth()).toBe(8);
    expect(periodEnd.getUTCDate()).toBe(30);
  });

  it('February leap year has 29 days', () => {
    const { periodEnd } = normalizePayrollMonthPeriod('2024-02-01', '2024-02-01');
    expect(periodEnd.getUTCDate()).toBe(29);
  });
});
