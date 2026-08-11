import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('customer invoice issue template', () => {
  it('credits deferred revenue purpose instead of sales revenue on issue', () => {
    const src = readFileSync(
      join(process.cwd(), 'lib/accountingV2/templates/pilotTemplates.js'),
      'utf8'
    );
    expect(src).toContain("resolvePurpose('DEFERRED_REVENUE')");
    const fnStart = src.indexOf('async function buildCustomerInvoiceDraft');
    const fnSlice = src.slice(fnStart, fnStart + 2500);
    expect(fnSlice).toContain('DEFERRED_REVENUE');
    expect(fnSlice).not.toContain("resolvePurpose('SALES_REVENUE')");
  });
});
