import { describe, it, expect } from 'vitest';
import { classifyContributionType } from '../lib/capitalContributionsQuery.js';

describe('classifyContributionType', () => {
  it('uses recorded asset type over debit-account heuristics', () => {
    expect(
      classifyContributionType({
        recordedType: 'asset',
        description: 'Cash capital contribution',
        debitAccount: { name: 'Cash on Hand', type: 'ASSET' },
      })
    ).toBe('asset');
  });

  it('classifies asset contribution descriptions as asset', () => {
    expect(
      classifyContributionType({
        description: 'Asset capital contribution - Delivery van',
        debitAccount: { name: 'Motor Vehicles', type: 'ASSET' },
      })
    ).toBe('asset');
    expect(
      classifyContributionType({
        description: 'Asset contribution — Equipment',
        debitAccount: { name: 'Equipment', accountType: 'Asset' },
      })
    ).toBe('asset');
  });

  it('classifies initial and cash contributions as cash', () => {
    expect(classifyContributionType({ description: 'Initial capital contribution' })).toBe('cash');
    expect(classifyContributionType({ description: 'Cash capital contribution' })).toBe('cash');
  });

  it('falls back to debit account when description is generic', () => {
    expect(
      classifyContributionType({
        description: 'Capital contribution',
        debitAccount: { name: 'Cash on Hand', type: 'ASSET' },
      })
    ).toBe('cash');
    expect(
      classifyContributionType({
        description: 'Capital contribution',
        debitAccount: { name: 'Furniture & Fixtures', type: 'ASSET' },
      })
    ).toBe('asset');
  });
});
