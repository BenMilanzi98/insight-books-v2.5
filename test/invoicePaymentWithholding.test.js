import { describe, it, expect } from 'vitest';
import { computeInvoicePaymentWithholding } from '../lib/invoicePaymentWithholding.js';

describe('computeInvoicePaymentWithholding', () => {
  it('returns cash-only when no withholding', () => {
    const r = computeInvoicePaymentWithholding(900, 0);
    expect(r.cashReceived).toBe(900);
    expect(r.withholdingAmount).toBe(0);
    expect(r.grossAppliedToAr).toBe(900);
  });

  it('splits cash and WHT on gross AR clearance', () => {
    const r = computeInvoicePaymentWithholding(900, 10);
    expect(r.withholdingAmount).toBe(100);
    expect(r.grossAppliedToAr).toBe(1000);
  });
});
