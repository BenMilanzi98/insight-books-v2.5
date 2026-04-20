import { describe, it, expect } from 'vitest';
import { computeMalawiPayeMonthly } from '../lib/malawiPAYE.js';
import { calculatePAYE as payeFromPayrollCalculations } from '../lib/payrollCalculations.js';
import { calculatePAYE as payeFromMalawiTaxUtils } from '../lib/malawiTaxUtils.js';

describe('Malawi monthly PAYE (marginal slabs)', () => {
  it('matches payrollCalculations and malawiTaxUtils numeric export', () => {
    const gross = 2_000_000;
    const a = computeMalawiPayeMonthly(gross).payeAmount;
    const b = payeFromPayrollCalculations(gross).payeAmount;
    const c = payeFromMalawiTaxUtils(gross);
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it('tax-free up to 170,000', () => {
    expect(computeMalawiPayeMonthly(0).payeAmount).toBe(0);
    expect(computeMalawiPayeMonthly(170_000).payeAmount).toBe(0);
  });

  it('first taxable kwacha at 30%', () => {
    expect(computeMalawiPayeMonthly(170_001).payeAmount).toBe(0.3);
  });

  it('mid 30% band', () => {
    // 500k gross: 330k @ 30% = 99,000
    expect(computeMalawiPayeMonthly(500_000).payeAmount).toBe(99_000);
  });

  it('boundary full 30% slab', () => {
    // 1.57m: 1.4m @ 30% = 420,000
    expect(computeMalawiPayeMonthly(1_570_000).payeAmount).toBe(420_000);
  });

  it('first kwacha in 35% band', () => {
    expect(computeMalawiPayeMonthly(1_570_001).payeAmount).toBe(420_000.35);
  });

  it('multi-band example 2M', () => {
    expect(computeMalawiPayeMonthly(2_000_000).payeAmount).toBe(570_500);
  });

  it('top of 35% slab before 40%', () => {
    expect(computeMalawiPayeMonthly(10_000_000).payeAmount).toBe(3_370_500);
  });

  it('first kwacha in 40% band', () => {
    expect(computeMalawiPayeMonthly(10_000_001).payeAmount).toBe(3_370_500.4);
  });

  it('11M gross', () => {
    expect(computeMalawiPayeMonthly(11_000_000).payeAmount).toBe(3_770_500);
  });
});
