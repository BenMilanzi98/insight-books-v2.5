import { describe, expect, it } from 'vitest';
import { computeBillableUnits, computeLineTotal } from '../lib/rentalBilling.js';

describe('rentalBilling', () => {
  it('computes day units', () => {
    const start = new Date('2026-07-01T00:00:00Z');
    const end = new Date('2026-07-04T00:00:00Z');
    expect(computeBillableUnits(start, end, 'day')).toBe(3);
  });

  it('computes line total with rounding', () => {
    expect(computeLineTotal(100, 1.5, 2)).toBe(300);
  });
});
