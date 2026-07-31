import { describe, expect, it, vi } from 'vitest';
import {
  resolveReceiptDateRange,
  buildSaleTaxData,
  normalizeSaleForReceiptPdf,
  ensureSaleLineItemsForReceipt,
  MAX_RECEIPTS_PER_EXPORT,
} from '../lib/saleReceiptExport.js';
import { drawSaleReceiptOnDoc, generateSaleReceiptPdfBuffer } from '../lib/server-pdf-jspdf.js';

describe('resolveReceiptDateRange', () => {
  const now = new Date(2026, 6, 15, 14, 30, 0); // Wed 15 Jul 2026

  it('resolves this_week from Monday through end of today', () => {
    const { dateFrom, dateTo, preset } = resolveReceiptDateRange({
      preset: 'this_week',
      now,
    });
    expect(preset).toBe('this_week');
    expect(dateFrom.getDay()).toBe(1); // Monday
    expect(dateFrom.getDate()).toBe(13);
    expect(dateTo.getDate()).toBe(15);
    expect(dateTo.getHours()).toBe(23);
  });

  it('resolves this_month from the 1st', () => {
    const { dateFrom, dateTo } = resolveReceiptDateRange({
      preset: 'this_month',
      now,
    });
    expect(dateFrom.getMonth()).toBe(6);
    expect(dateFrom.getDate()).toBe(1);
    expect(dateTo.getDate()).toBe(15);
  });

  it('resolves this_year from Jan 1', () => {
    const { dateFrom } = resolveReceiptDateRange({ preset: 'this_year', now });
    expect(dateFrom.getFullYear()).toBe(2026);
    expect(dateFrom.getMonth()).toBe(0);
    expect(dateFrom.getDate()).toBe(1);
  });

  it('resolves custom range', () => {
    const { dateFrom, dateTo } = resolveReceiptDateRange({
      preset: 'custom',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      now,
    });
    expect(dateFrom.getDate()).toBe(1);
    expect(dateTo.getDate()).toBe(31);
    expect(dateTo.getMonth()).toBe(0);
  });

  it('rejects inverted custom range', () => {
    expect(() =>
      resolveReceiptDateRange({
        preset: 'custom',
        dateFrom: '2026-03-01',
        dateTo: '2026-01-01',
        now,
      })
    ).toThrow(/dateFrom must be on or before dateTo/i);
  });
});

describe('buildSaleTaxData', () => {
  it('groups item taxes without double-counting quantity', () => {
    const taxData = buildSaleTaxData(
      [
        {
          itemTaxes: [
            { taxName: 'VAT', taxCode: 'VAT', taxAmount: 16.5 },
          ],
        },
        {
          itemTaxes: [
            { taxName: 'VAT', taxCode: 'VAT', taxAmount: 8.25 },
          ],
        },
      ],
      0
    );
    expect(taxData.hasAnyTaxes).toBe(true);
    expect(taxData.totalTaxAmount).toBeCloseTo(24.75, 2);
    expect(taxData.taxGroups).toHaveLength(1);
  });
});

describe('normalizeSaleForReceiptPdf', () => {
  it('converts Decimal-like values to numbers', () => {
    const sale = normalizeSaleForReceiptPdf({
      subtotal: { toNumber: () => 100 },
      total: { toNumber: () => 116.5 },
      totalTaxAmount: '16.5',
      totalDiscountAmount: 0,
      items: [
        {
          amount: { toNumber: () => 100 },
          unitPrice: 100,
          discountAmount: 0,
          taxAmount: 16.5,
          itemTaxes: [],
        },
      ],
      payments: [],
    });
    expect(sale.subtotal).toBe(100);
    expect(sale.total).toBe(116.5);
    expect(sale.items[0].amount).toBe(100);
  });
});

describe('drawSaleReceiptOnDoc / bulk page starts', () => {
  it('starts each subsequent receipt on a new page', async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const addPageSpy = vi.spyOn(doc, 'addPage');

    const sale = {
      saleNumber: 'POS-1',
      saleDate: new Date('2026-07-15T10:00:00'),
      subtotal: 10,
      total: 10,
      totalDiscountAmount: 0,
      totalTaxAmount: 0,
      tenant: { name: 'Test Co' },
      client: { name: 'Walk-in' },
      createdBy: { name: 'Cashier' },
      items: [{ description: 'Item', quantity: 1, unitPrice: 10, discountAmount: 0 }],
      payments: [],
    };

    drawSaleReceiptOnDoc(doc, sale, { currencyCode: 'MWK' }, null, {
      startOnNewPage: false,
    });
    drawSaleReceiptOnDoc(doc, { ...sale, saleNumber: 'POS-2' }, { currencyCode: 'MWK' }, null, {
      startOnNewPage: true,
    });

    expect(addPageSpy).toHaveBeenCalled();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });

  it('generateSaleReceiptPdfBuffer still returns a PDF buffer', () => {
    const buf = generateSaleReceiptPdfBuffer(
      {
        saleNumber: 'POS-9',
        saleDate: new Date('2026-07-15T10:00:00'),
        subtotal: 5,
        total: 5,
        totalDiscountAmount: 0,
        totalTaxAmount: 0,
        tenant: { name: 'Test Co' },
        items: [{ description: 'A', quantity: 1, unitPrice: 5, discountAmount: 0 }],
        payments: [],
      },
      { currencyCode: 'MWK' },
      null
    );
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  });
});

describe('ensureSaleLineItemsForReceipt', () => {
  it('keeps existing items', () => {
    const items = ensureSaleLineItemsForReceipt({
      items: [{ description: 'A', quantity: 1, unitPrice: 10, amount: 10 }],
      subtotal: 10,
    });
    expect(items).toHaveLength(1);
    expect(items[0].description).toBe('A');
  });

  it('rebuilds lines from inventory consumptions when SaleItems are missing', () => {
    const items = ensureSaleLineItemsForReceipt({
      items: [],
      subtotal: 40000,
      total: 40000,
      inventoryBatchConsumptions: [
        {
          id: 'c1',
          quantity: 2,
          batch: { product: { id: 'p1', name: 'Jone Doe', sku: null } },
        },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0].description).toBe('Jone Doe');
    expect(items[0].quantity).toBe(2);
    expect(items[0].unitPrice).toBe(20000);
    expect(items[0].amount).toBe(40000);
  });

  it('falls back to a single totals line when nothing else is available', () => {
    const items = ensureSaleLineItemsForReceipt({
      items: [],
      subtotal: 5000,
      total: 5000,
      notes: '',
    });
    expect(items).toHaveLength(1);
    expect(items[0].description).toBe('Sale');
    expect(items[0].amount).toBe(5000);
  });
});

describe('export limits', () => {
  it('exposes a 5000 receipt cap', () => {
    expect(MAX_RECEIPTS_PER_EXPORT).toBe(5000);
  });
});
