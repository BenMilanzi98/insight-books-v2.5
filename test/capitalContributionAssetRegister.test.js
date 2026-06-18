import { describe, it, expect } from 'vitest';
import {
  resolveCategoryNameFromAssetType,
  resolveUsefulLifeYears,
  capitalContributionNotesMarker,
  isCapitalContributionAssetNotes,
} from '../lib/capitalContributionAssetRegister.js';

describe('capitalContributionAssetRegister', () => {
  it('maps capital account asset types to category names', () => {
    expect(resolveCategoryNameFromAssetType('Equipment')).toBe('Equipment');
    expect(resolveCategoryNameFromAssetType('Motor Vehicle')).toBe('Motor Vehicles');
    expect(resolveCategoryNameFromAssetType('Computer')).toBe('Computer & Electronics');
    expect(resolveCategoryNameFromAssetType('')).toBe('Owner Contributed Assets');
  });

  it('assigns sensible useful life by type', () => {
    expect(resolveUsefulLifeYears('Computer')).toBe(3);
    expect(resolveUsefulLifeYears('Building')).toBe(25);
    expect(resolveUsefulLifeYears('unknown')).toBe(5);
  });

  it('builds stable notes markers for idempotent register', () => {
    const marker = capitalContributionNotesMarker('txn_abc');
    expect(marker).toBe('CAPITAL_CONTRIBUTION:txn_abc');
    expect(isCapitalContributionAssetNotes(`Line1\n${marker}\nRef: CAP-1`)).toBe(true);
  });
});
