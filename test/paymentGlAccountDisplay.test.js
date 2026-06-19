import { describe, it, expect } from 'vitest';
import { buildPaymentGlAccountDisplayName } from '../lib/paymentAccountCoaLink.js';

describe('buildPaymentGlAccountDisplayName', () => {
  it('combines payment account name and reference', () => {
    expect(
      buildPaymentGlAccountDisplayName({ name: 'Operations', reference: '1000123456' })
    ).toBe('Operations · 1000123456');
  });

  it('uses name only when reference is empty', () => {
    expect(buildPaymentGlAccountDisplayName({ name: 'Petty float', reference: '' })).toBe('Petty float');
  });

  it('falls back when name is missing', () => {
    expect(buildPaymentGlAccountDisplayName({ name: '', reference: '999' })).toBe('Payment account · 999');
  });
});
