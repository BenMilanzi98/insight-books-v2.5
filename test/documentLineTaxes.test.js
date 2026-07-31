import { describe, expect, it } from 'vitest';
import {
  normalizeLineTaxes,
  denormalizedPercentageTaxRate,
  resolveLineTaxesInput,
} from '../lib/documentLineTaxes.js';

describe('documentLineTaxes', () => {
  it('normalizes productTaxes with nested taxType', () => {
    const taxes = normalizeLineTaxes([
      { taxType: { id: 't1', taxName: 'VAT', taxCode: 'VAT', taxRate: 16.5, calculationType: 'Percentage' } },
      { id: 't2', taxName: 'Levy', taxCode: 'L', taxRate: 50, calculationType: 'Fixed' },
    ]);
    expect(taxes).toHaveLength(2);
    expect(taxes[0]).toMatchObject({ taxTypeId: 't1', taxRate: 16.5, calculationType: 'Percentage' });
    expect(taxes[1]).toMatchObject({ taxTypeId: 't2', calculationType: 'Fixed' });
  });

  it('sums only percentage rates for denormalized taxRate', () => {
    expect(
      denormalizedPercentageTaxRate([
        { taxRate: 16.5, calculationType: 'Percentage' },
        { taxRate: 1, calculationType: 'Percentage' },
        { taxRate: 50, calculationType: 'Fixed' },
      ])
    ).toBe(17.5);
  });

  it('resolveLineTaxesInput prefers taxes over taxRate-only', () => {
    expect(resolveLineTaxesInput({ taxes: [{ id: 'a', taxRate: 16.5, calculationType: 'Percentage' }] })).toHaveLength(1);
    expect(resolveLineTaxesInput({ taxRate: 16.5 })).toEqual([]);
  });
});
