import { describe, it, expect } from 'vitest';
import {
  MALAWI_TAX_CATALOG,
  getMalawiTaxCatalogEntry,
  isMalawiSystemTaxType,
  isTaxGlChildCode,
} from '../lib/malawiTaxCatalog.js';

describe('malawiTaxCatalog', () => {
  it('includes all user-listed Malawi tax types plus VAT input', () => {
    const names = MALAWI_TAX_CATALOG.map((t) => t.taxName.toLowerCase());
    expect(names.some((n) => n.includes('income tax') && !n.includes('corporate'))).toBe(true);
    expect(names.some((n) => n.includes('corporate income'))).toBe(true);
    expect(names.some((n) => n.includes('pay as you earn') || n.includes('paye'))).toBe(true);
    expect(names.some((n) => n.includes('provisional'))).toBe(true);
    expect(names.some((n) => n.includes('withholding'))).toBe(true);
    expect(names.some((n) => n.includes('fringe benefit'))).toBe(true);
    expect(names.some((n) => n.includes('turnover'))).toBe(true);
    expect(names.some((n) => n.includes('value added tax'))).toBe(true);
    expect(names.some((n) => n.includes('excise'))).toBe(true);
    expect(names.some((n) => n.includes('tevet'))).toBe(true);
    expect(names.some((n) => n.includes('royalty'))).toBe(true);
    expect(names.some((n) => n.includes('capital gains'))).toBe(true);
    expect(names.some((n) => n.includes('minimum alternative'))).toBe(true);
    expect(names.some((n) => n.includes('supernormal'))).toBe(true);
    expect(names.some((n) => n.includes('gambling'))).toBe(true);
    expect(names.some((n) => n.includes('money transfer'))).toBe(true);
    expect(MALAWI_TAX_CATALOG.length).toBeGreaterThanOrEqual(17);
  });

  it('maps inflow taxes under 2041 and outflow under 2045', () => {
    for (const entry of MALAWI_TAX_CATALOG) {
      expect(entry.glCode.startsWith(entry.flow === 'inflow' ? '2041-' : '2045-')).toBe(true);
      expect(isTaxGlChildCode(entry.glCode)).toBe(true);
    }
  });

  it('recognises system tax types', () => {
    expect(isMalawiSystemTaxType({ taxId: 'MW-VAT' })).toBe(true);
    expect(isMalawiSystemTaxType({ taxId: 'CUSTOM' })).toBe(false);
    expect(getMalawiTaxCatalogEntry('PAYE')?.flow).toBe('inflow');
    expect(getMalawiTaxCatalogEntry('MW-VAT-IN')?.flow).toBe('outflow');
  });
});
