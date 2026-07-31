import { describe, expect, it } from 'vitest';
import {
  normalizeItemName,
  validateItemName,
  matchProductsByNormalizedName,
} from '../../lib/stock/itemNameNormalization.js';

describe('normalizeItemName', () => {
  it('matches case and whitespace variants', () => {
    const expected = 'cooking oil';
    expect(normalizeItemName('Cooking Oil')).toBe(expected);
    expect(normalizeItemName(' cooking oil ')).toBe(expected);
    expect(normalizeItemName('COOKING OIL')).toBe(expected);
    expect(normalizeItemName('Cooking   Oil')).toBe(expected);
  });
});

describe('validateItemName', () => {
  it('rejects empty and symbol-only names', () => {
    expect(validateItemName('   ').ok).toBe(false);
    expect(validateItemName('***').ok).toBe(false);
  });

  it('accepts normal names', () => {
    const r = validateItemName('  Cooking Oil  ');
    expect(r).toMatchObject({ ok: true, displayName: 'Cooking Oil', normalizedName: 'cooking oil' });
  });
});

describe('matchProductsByNormalizedName', () => {
  it('returns MATCH for one hit and AMBIGUOUS for duplicates', () => {
    const products = [
      { id: '1', name: 'Cooking Oil', normalizedName: 'cooking oil' },
      { id: '2', name: 'Soap', normalizedName: 'soap' },
    ];
    expect(matchProductsByNormalizedName(products, 'COOKING OIL').status).toBe('MATCH');
    expect(
      matchProductsByNormalizedName(
        [
          { id: '1', name: 'Cooking Oil', normalizedName: 'cooking oil' },
          { id: '3', name: 'cooking oil', normalizedName: 'cooking oil' },
        ],
        'Cooking Oil'
      ).status
    ).toBe('AMBIGUOUS');
  });
});
