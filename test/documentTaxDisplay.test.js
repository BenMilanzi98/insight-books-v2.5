import { describe, expect, it } from 'vitest';
import {
  shouldDisplayDocumentTax,
  documentHasLineTax,
  taxLineAmount,
} from '../lib/documentTaxDisplay.js';
import { buildSaleTaxData } from '../lib/saleReceiptExport.js';

describe('documentTaxDisplay', () => {
  it('shouldDisplayDocumentTax hides zero totals without positive lines', () => {
    expect(shouldDisplayDocumentTax({ taxAmount: 0 })).toBe(false);
    expect(shouldDisplayDocumentTax({ taxAmount: 0, taxLines: [{ taxAmount: 0 }] })).toBe(false);
  });

  it('shouldDisplayDocumentTax shows positive totals or lines', () => {
    expect(shouldDisplayDocumentTax({ taxAmount: 100 })).toBe(true);
    expect(shouldDisplayDocumentTax({ taxAmount: 0, taxLines: [{ taxAmount: 50 }] })).toBe(true);
    expect(taxLineAmount({ totalAmount: 25 })).toBe(25);
  });

  it('documentHasLineTax detects line-level tax', () => {
    expect(documentHasLineTax([{ taxRate: 0, taxAmount: 0 }])).toBe(false);
    expect(documentHasLineTax([{ taxRate: 16.5 }])).toBe(true);
    expect(documentHasLineTax([{ itemTaxes: [{ taxAmount: 10 }] }])).toBe(true);
  });
});

describe('buildSaleTaxData zero gating', () => {
  it('does not flag taxes when itemTaxes exist but amounts are zero', () => {
    const data = buildSaleTaxData(
      [{ itemTaxes: [{ taxName: 'VAT', taxAmount: 0 }] }],
      0,
    );
    expect(data.hasAnyTaxes).toBe(false);
    expect(data.taxGroups).toHaveLength(0);
  });

  it('includes positive tax groups', () => {
    const data = buildSaleTaxData(
      [{ itemTaxes: [{ taxName: 'VAT', taxAmount: 100 }] }],
      0,
    );
    expect(data.hasAnyTaxes).toBe(true);
    expect(data.taxGroups).toHaveLength(1);
    expect(data.totalTaxAmount).toBe(100);
  });
});
