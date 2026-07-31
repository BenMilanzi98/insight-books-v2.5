import { describe, it, expect } from 'vitest';
import { validateTaxRate } from '../lib/taxRateValidation.js';

describe('validateTaxRate', () => {
  it('accepts percentage rates including fractional', () => {
    expect(validateTaxRate(17.5, 'Percentage')).toEqual({ ok: true, value: 17.5 });
    expect(validateTaxRate('0.05', 'Percentage')).toEqual({ ok: true, value: 0.05 });
  });

  it('rejects invalid percentage', () => {
    expect(validateTaxRate(101, 'Percentage').ok).toBe(false);
    expect(validateTaxRate(-1, 'Percentage').ok).toBe(false);
  });

  it('accepts large fixed amounts', () => {
    expect(validateTaxRate(50000, 'Fixed')).toEqual({ ok: true, value: 50000 });
  });
});
