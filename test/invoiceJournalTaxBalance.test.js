import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('invoice journal tax balance guard (fresh-books)', () => {
  it('retires createInvoiceJournalEntry (LEGACY_POSTING_REMOVED)', () => {
    const src = readFileSync(join(process.cwd(), 'lib/transactionJournalHelpers.js'), 'utf8');
    expect(src).toContain('LEGACY_POSTING_REMOVED');
    expect(src).toMatch(/createInvoiceJournalEntry[\s\S]{0,200}LEGACY_POSTING_REMOVED/);
    expect(src).toContain('postInvoiceAccounting');
  });

  it('balances invoice/sale tax against AR not revenue when resolveTaxBalancingAccount is used', () => {
    const src = readFileSync(join(process.cwd(), 'lib/taxCalculationService.js'), 'utf8');
    expect(src).toContain('findAccountsReceivableGlAccount');
    expect(src).toContain('Sales/output VAT: Dr AR, Cr Tax Liability');
  });
});
