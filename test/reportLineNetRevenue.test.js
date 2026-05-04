import { describe, it, expect } from 'vitest';
import {
  invoiceItemNetRevenueExTax,
  invoiceNetRevenueTotalExTax,
  saleDocumentTaxAmount,
  saleItemNetRevenueExTax,
  saleNetRevenueTotalExTax,
} from '../lib/reportLineNetRevenue.js';

describe('reportLineNetRevenue', () => {
  it('uses invoice netAmount as the authoritative pre-tax line value', () => {
    expect(invoiceItemNetRevenueExTax({
      quantity: 2,
      unitPrice: 100,
      discountAmount: 5,
      netAmount: 190,
    })).toBe(190);
  });

  it('falls back to invoice quantity * unit price minus per-item discount', () => {
    expect(invoiceItemNetRevenueExTax({
      quantity: 3,
      unitPrice: 50,
      discountAmount: 4,
    })).toBe(138);
  });

  it('uses POS line amount minus the line discount total', () => {
    expect(saleItemNetRevenueExTax({
      amount: 500,
      discountAmount: 45,
    })).toBe(455);
  });

  it('totals invoice and POS documents net of tax and discounts', () => {
    expect(invoiceNetRevenueTotalExTax({
      total: 354,
      taxAmount: 54,
      items: [
        { quantity: 2, unitPrice: 100, discountAmount: 10, netAmount: 180 },
        { quantity: 1, unitPrice: 120, discountAmount: 0, netAmount: 120 },
      ],
    })).toBe(300);

    expect(saleNetRevenueTotalExTax({
      total: 354,
      totalTaxAmount: 54,
      items: [
        { amount: 200, discountAmount: 20 },
        { amount: 120, discountAmount: 0 },
      ],
    })).toBe(300);
  });

  it('prefers header POS tax when present and falls back to item tax', () => {
    expect(saleDocumentTaxAmount({ totalTaxAmount: 17, taxAmount: 12, items: [] })).toBe(17);
    expect(saleDocumentTaxAmount({ items: [{ taxAmount: 5 }, { taxAmount: 7.5 }] })).toBe(12.5);
  });
});
