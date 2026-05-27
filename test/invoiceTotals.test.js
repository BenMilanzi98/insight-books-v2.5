import { describe, expect, it } from 'vitest';
import { calculateInvoiceTotals } from '../lib/invoiceTotals.js';

describe('invoiceTotals', () => {
  it('sums large amounts accurately', () => {
    const items = [
      { quantity: 1, unitPrice: 10265.43, discountAmount: 0, taxRate: 0, description: 'A', accountId: 'x' },
      { quantity: 1, unitPrice: 152573.11, discountAmount: 0, taxRate: 0, description: 'B', accountId: 'x' },
    ];
    const t = calculateInvoiceTotals(items, 0);
    expect(t.subtotal).toBe(162838.54);
    expect(t.total).toBe(162838.54);
  });

  it('applies global discount before tax proportionally', () => {
    const items = [
      {
        quantity: 2,
        unitPrice: 100,
        discountAmount: 0,
        taxRate: 16.5,
        description: 'Item',
        accountId: 'x',
      },
    ];
    const t = calculateInvoiceTotals(items, 10);
    expect(t.globalDiscount).toBe(10);
    expect(t.taxAmount).toBe(31.35);
    expect(t.total).toBe(221.35);
  });
});
