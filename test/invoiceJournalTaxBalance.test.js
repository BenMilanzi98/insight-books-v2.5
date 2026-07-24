import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('invoice journal tax balance guard', () => {
  it('keeps revenue JE on net AR (does not add line tax into AR debit)', () => {
    const src = readFileSync(join(process.cwd(), 'lib/transactionJournalHelpers.js'), 'utf8');
    // Regression: totalLineTax must not inflate arDebit when tax posts separately
    expect(src).toContain('const arDebit = roundMoney(totalNet)');
    expect(src).toContain('Line tax on items must NOT inflate AR here');
    expect(src).not.toMatch(
      /arDebit\s*=\s*[\s\S]{0,120}totalNet\s*\+\s*totalLineTax/
    );
  });

  it('balances invoice/sale tax against AR not revenue', () => {
    const src = readFileSync(join(process.cwd(), 'lib/taxCalculationService.js'), 'utf8');
    expect(src).toContain('findAccountsReceivableGlAccount');
    expect(src).toContain('Sales/output VAT: Dr AR, Cr Tax Liability');
  });
});
