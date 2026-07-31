import { describe, expect, it } from 'vitest';
import { calculateInvoiceTotals } from '../lib/invoiceTotals.js';

describe('calculateInvoiceTotals multi-tax', () => {
  it('adds percentage and fixed taxes on taxable net after discounts', () => {
    const totals = calculateInvoiceTotals(
      [
        {
          description: 'Item',
          quantity: 2,
          unitPrice: 500,
          discountAmount: 0,
          taxes: [
            { id: 'vat', taxName: 'VAT', taxCode: 'VAT', taxRate: 16.5, calculationType: 'Percentage' },
            { id: 'levy', taxName: 'Levy', taxCode: 'L', taxRate: 10, calculationType: 'Fixed' },
          ],
        },
      ],
      0
    );
    // taxable net 1000; VAT 165; Fixed 10*2=20; tax 185; total 1185
    expect(totals.taxAmount).toBe(185);
    expect(totals.total).toBe(1185);
    expect(totals.processedItems[0].itemTaxes).toHaveLength(2);
    expect(totals.processedItems[0].taxRate).toBe(16.5);
  });

  it('applies global discount before multi-tax', () => {
    const totals = calculateInvoiceTotals(
      [
        {
          quantity: 1,
          unitPrice: 1000,
          discountAmount: 0,
          taxes: [{ id: 'vat', taxRate: 10, calculationType: 'Percentage', taxName: 'VAT' }],
        },
      ],
      100
    );
    // taxable 900; tax 90; total 990
    expect(totals.taxAmount).toBe(90);
    expect(totals.total).toBe(990);
  });

  it('falls back to single taxRate when no taxes array', () => {
    const totals = calculateInvoiceTotals([
      { quantity: 1, unitPrice: 1000, discountAmount: 0, taxRate: 16.5 },
    ]);
    expect(totals.taxAmount).toBe(165);
    expect(totals.processedItems[0].itemTaxes).toEqual([]);
  });
});
