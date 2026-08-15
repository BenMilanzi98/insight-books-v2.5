import { describe, expect, it } from 'vitest';
import { formatDesktopDocNumber, nextSeq } from '../../lib/desktop/documentNumbers.js';

describe('formatDesktopDocNumber', () => {
  it('formats prefix-type-seq', () => {
    expect(formatDesktopDocNumber({ prefix: 'TILL1', type: 'SALE', seq: 12 })).toBe('TILL1-SALE-12');
  });
});

describe('nextSeq', () => {
  it('increments from lastIssued', () => {
    expect(nextSeq(0)).toBe(1);
    expect(nextSeq(7)).toBe(8);
  });
});
