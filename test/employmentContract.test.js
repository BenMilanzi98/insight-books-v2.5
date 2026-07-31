import { describe, expect, it } from 'vitest';
import {
  CONTRACT_STATUSES,
  contractsOverlap,
  assertNoActiveContractOverlap,
  resolvePayBasis,
} from '../lib/employmentContract.js';

describe('employmentContract', () => {
  it('detects overlapping active date ranges', () => {
    const a = {
      status: CONTRACT_STATUSES.ACTIVE,
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
    };
    const b = {
      status: CONTRACT_STATUSES.ACTIVE,
      effectiveFrom: new Date('2026-06-01'),
      effectiveTo: new Date('2026-12-31'),
    };
    expect(contractsOverlap(a, b)).toBe(true);
  });

  it('allows non-overlapping ranges', () => {
    const a = {
      status: CONTRACT_STATUSES.ACTIVE,
      effectiveFrom: new Date('2025-01-01'),
      effectiveTo: new Date('2025-12-31'),
    };
    const b = {
      status: CONTRACT_STATUSES.ACTIVE,
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
    };
    expect(contractsOverlap(a, b)).toBe(false);
  });

  it('assertNoActiveContractOverlap throws on overlap', () => {
    const existing = [
      {
        id: 'c1',
        status: CONTRACT_STATUSES.ACTIVE,
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
      },
    ];
    expect(() =>
      assertNoActiveContractOverlap(existing, {
        status: CONTRACT_STATUSES.ACTIVE,
        effectiveFrom: new Date('2026-03-01'),
        effectiveTo: null,
      })
    ).toThrow(/overlap/i);
  });

  it('resolvePayBasis prefers explicit payBasis', () => {
    expect(resolvePayBasis({ payBasis: 'HOURLY_RATE', hourlyRate: 10, basicSalary: 1000 })).toBe(
      'HOURLY_RATE'
    );
  });

  it('resolvePayBasis falls back from rates without inventing hybrid', () => {
    expect(resolvePayBasis({ hourlyRate: 50, basicSalary: null })).toBe('HOURLY_RATE');
    expect(resolvePayBasis({ hourlyRate: null, basicSalary: 500000 })).toBe('MONTHLY_SALARY');
    expect(resolvePayBasis({})).toBe('MONTHLY_SALARY');
  });
});
