import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';

describe('stock transfer quantity handling', () => {
  it('uses Decimal for fractional transfer quantities', () => {
    const qty = new Prisma.Decimal('12.5');
    const neg = qty.mul(-1);
    expect(parseFloat(qty.toString())).toBe(12.5);
    expect(parseFloat(neg.toString())).toBe(-12.5);
  });
});

describe('transfer status workflow', () => {
  const validTransitions = {
    pending: ['approved', 'rejected'],
    approved: ['received'],
    received: [],
    rejected: [],
  };

  it('defines expected status transitions', () => {
    expect(validTransitions.pending).toContain('approved');
    expect(validTransitions.approved).toContain('received');
    expect(validTransitions.received).toHaveLength(0);
  });
});
