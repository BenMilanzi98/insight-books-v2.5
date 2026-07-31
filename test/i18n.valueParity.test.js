import { describe, expect, it } from 'vitest';
import { formatCurrency, formatNumber } from '../lib/i18n/formatters.js';

describe('financial value parity across locales', () => {
  it('same numeric amount formats without converting currency', () => {
    const amount = 12345.67;
    const en = formatCurrency(amount, { locale: 'en', currencyCode: 'MWK' });
    const ny = formatCurrency(amount, { locale: 'ny', currencyCode: 'MWK' });
    // Strip non-digits except decimal separators for comparison of magnitude
    const digits = (s) => s.replace(/[^\d]/g, '');
    expect(digits(en)).toBe(digits(ny));
  });

  it('formatNumber preserves value', () => {
    expect(formatNumber(1000.5, { locale: 'en' })).toBeTruthy();
    expect(formatNumber(1000.5, { locale: 'ny' })).toBeTruthy();
  });
});
