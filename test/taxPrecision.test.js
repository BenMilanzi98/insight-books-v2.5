import { describe, expect, it } from 'vitest';
import { calculateInvoiceTotals } from '../lib/invoiceTotals.js';
import { calculateProductTaxes, calculateSaleItemTaxes } from '../lib/productTaxCalculations.js';
import { calculateTaxAmount } from '../lib/taxCalculationService.js';
import { normalizeExpenseAmountsForGl } from '../lib/expenseGlPosting.js';

describe('tax precision', () => {
  it('calculates percentage tax on decimal sale prices without whole-number rounding', () => {
    const totals = calculateInvoiceTotals([
      { quantity: 2, unitPrice: 10000.73, discountAmount: 0, taxRate: 16.5 },
      { quantity: 3, unitPrice: 10.77, discountAmount: 0, taxRate: 16.5 },
    ]);

    expect(totals.subtotal).toBe(20033.77);
    expect(totals.taxAmount).toBe(3305.57);
    expect(totals.total).toBe(23339.34);
  });

  it('calculates product tax breakdowns with decimal quantities and fixed taxes', () => {
    const result = calculateProductTaxes(
      35002.56,
      [
        { id: 'vat', taxRate: 16.5, calculationType: 'Percentage', taxName: 'VAT' },
        { id: 'levy', taxRate: 0.73, calculationType: 'Fixed', taxName: 'Levy' },
      ],
      3.5
    );

    expect(result.taxBreakdown.map((t) => t.taxAmount)).toEqual([5775.42, 2.56]);
    expect(result.totalTaxAmount).toBe(5777.98);
  });

  it('recalculates sale item tax from quantity × price minus discount', () => {
    const result = calculateSaleItemTaxes({
      quantity: 2,
      unitPrice: 10000.73,
      discountAmount: 1.11,
      taxes: [{ id: 'vat', taxRate: 16.5, calculationType: 'Percentage' }],
    });

    expect(result.totalTaxAmount).toBe(3300.06);
  });

  it('rounds generic tax service and expense tax split to cents', () => {
    expect(calculateTaxAmount(10000.73, { status: 'Active', taxRate: 16.5 })).toBe(1650.12);
    expect(normalizeExpenseAmountsForGl(11650.85, 1650.12)).toEqual({
      base: 10000.73,
      tax: 1650.12,
    });
  });
});
