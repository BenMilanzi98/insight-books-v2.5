import { describe, it, expect } from 'vitest';
import { extractLinesFromPayload } from '../../lib/setupWizard/openingLineCompiler.js';
import { runSetupReconciliations } from '../../lib/setupWizard/reconciliationService.js';

describe('runSetupReconciliations', () => {
  it('passes when step totals match filtered GL lines', () => {
    const arLines = extractLinesFromPayload(
      {
        lines: [
          { accountId: 'ar', debit: '25.00', customerId: 'c1' },
          { accountId: 'obe', credit: '25.00' },
        ],
      },
      'openingReceivables'
    );
    arLines.forEach((l) => {
      l.accountName = l.accountId === 'ar' ? 'Accounts Receivable' : 'Opening Balance Equity';
    });

    const compiled = {
      byStep: { openingReceivables: arLines },
      lines: arLines,
    };

    const result = runSetupReconciliations(compiled, {
      ACCOUNTS_RECEIVABLE_CONTROL: 'ar',
    });
    const ar = result.results.find((r) => r.control === 'ACCOUNTS_RECEIVABLE');
    expect(ar.status).toBe('PASSED');
  });
});
