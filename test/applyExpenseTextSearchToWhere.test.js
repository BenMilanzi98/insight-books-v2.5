import { describe, expect, it } from 'vitest';
import { applyExpenseTextSearchToWhere } from '../lib/applyExpenseTextSearchToWhere.js';

describe('applyExpenseTextSearchToWhere', () => {
  it('sets OR when no branch OR present', () => {
    const w = { tenantId: 't1' };
    applyExpenseTextSearchToWhere(w, 'fuel');
    expect(w.OR).toHaveLength(3);
    expect(w.AND).toBeUndefined();
  });

  it('combines branch OR with search using AND', () => {
    const w = {
      tenantId: 't1',
      OR: [{ branchId: 'b1' }, { branchId: null }],
    };
    applyExpenseTextSearchToWhere(w, 'fuel');
    expect(w.OR).toBeUndefined();
    expect(Array.isArray(w.AND)).toBe(true);
    expect(w.AND).toHaveLength(2);
    expect(w.AND[0].OR).toEqual([{ branchId: 'b1' }, { branchId: null }]);
    expect(w.AND[1].OR).toHaveLength(3);
  });

  it('no-ops on blank search', () => {
    const w = { tenantId: 't1', OR: [{ branchId: 'b1' }] };
    applyExpenseTextSearchToWhere(w, '   ');
    expect(w.OR).toEqual([{ branchId: 'b1' }]);
  });
});
