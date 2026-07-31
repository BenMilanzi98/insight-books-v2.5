import { describe, expect, it } from 'vitest';
import { pickContractForDate, CONTRACT_STATUSES } from '../lib/employmentContract.js';

describe('resolveEmployeeCompensation — contract date pick', () => {
  it('picks ACTIVE contract covering asOf over older ACTIVE', () => {
    const contracts = [
      {
        id: 'old',
        status: CONTRACT_STATUSES.ACTIVE,
        effectiveFrom: new Date('2025-01-01'),
        effectiveTo: new Date('2025-12-31'),
        version: 1,
      },
      {
        id: 'new',
        status: CONTRACT_STATUSES.ACTIVE,
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
        version: 2,
      },
    ];
    const picked = pickContractForDate(contracts, new Date('2026-06-15'));
    expect(picked?.id).toBe('new');
  });

  it('returns null when asOf is before any contract', () => {
    const contracts = [
      {
        id: 'c1',
        status: CONTRACT_STATUSES.ACTIVE,
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
      },
    ];
    expect(pickContractForDate(contracts, new Date('2025-06-01'))).toBeNull();
  });
});
