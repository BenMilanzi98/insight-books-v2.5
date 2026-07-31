import { describe, it, expect } from 'vitest';
import { projectThreeStatements } from '../lib/financialPlanning/domain/threeStatementEngine.js';
import { parseToMinor } from '../lib/financialPlanning/domain/money.js';

/**
 * Export must reuse engine payload totals (no independent math).
 * Full Excel path is covered via exportService when DB-backed version exists.
 */
describe('export payload integrity', () => {
  it('preserves checksum and CF=BS cash for export source payload', () => {
    const result = projectThreeStatements({
      opening: {
        cash: '100000.00',
        receivables: '50000.00',
        inventory: '40000.00',
        fixedAssetsGross: '200000.00',
        accumulatedDepreciation: '50000.00',
        payables: '30000.00',
        longTermDebt: '100000.00',
        equity: '150000.00',
        retainedEarnings: '60000.00',
      },
      baseRevenueMinor: parseToMinor('80000'),
      months: 3,
      assumptions: { grossMarginBps: 4000, opexPercentOfRevenueBps: 2000 },
    });
    expect(result.integrityStatus).toBe('VALID');
    expect(result.checksum).toHaveLength(64);
    for (const p of result.periods) {
      expect(p.cashFlow.closingCash.minor).toBe(p.balanceSheet.cash.minor);
    }
  });
});
