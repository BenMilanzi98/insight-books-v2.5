import { describe, it, expect } from 'vitest';
import {
  assessHistoricalDataQuality,
  buildSeasonalIndices,
} from '../lib/financialPlanning/domain/historicalQuality.js';
import { compareScenarios } from '../lib/financialPlanning/application/forecastService.js';
import { projectThreeStatements } from '../lib/financialPlanning/domain/threeStatementEngine.js';
import { parseToMinor } from '../lib/financialPlanning/domain/money.js';

describe('historical data quality', () => {
  it('marks short series unsuitable for automatic baseline', () => {
    const q = assessHistoricalDataQuality({ periodCount: 2, closedPeriodCount: 2 });
    expect(q.status).toBe('UNSUITABLE_FOR_AUTOMATIC_BASELINE');
    expect(q.suitableForAutomaticBaseline).toBe(false);
  });

  it('requires 12 months for seasonality', () => {
    const s = buildSeasonalIndices([1, 2, 3]);
    expect(s.indicesBps).toBeNull();
    expect(s.confidence).toBe('INSUFFICIENT_DATA');
  });

  it('builds 12 seasonal indices when enough history', () => {
    const series = Array.from({ length: 24 }, (_, i) => 100 + (i % 12) * 10);
    const s = buildSeasonalIndices(series);
    expect(s.indicesBps).toHaveLength(12);
    expect(s.confidence).toBe('MODERATE');
  });
});

describe('scenario comparison', () => {
  const opening = {
    cash: '100000.00',
    receivables: '50000.00',
    inventory: '40000.00',
    fixedAssetsGross: '200000.00',
    accumulatedDepreciation: '50000.00',
    payables: '30000.00',
    longTermDebt: '100000.00',
    equity: '150000.00',
    retainedEarnings: '60000.00',
  };

  it('compares scenarios on same model version', () => {
    const expected = projectThreeStatements({
      opening,
      baseRevenueMinor: parseToMinor('80000'),
      months: 6,
      assumptions: { revenueGrowthBps: 0, grossMarginBps: 4000, opexPercentOfRevenueBps: 2000 },
    });
    const optimistic = projectThreeStatements({
      opening,
      baseRevenueMinor: parseToMinor('80000'),
      months: 6,
      assumptions: { revenueGrowthBps: 200, grossMarginBps: 4000, opexPercentOfRevenueBps: 2000 },
    });
    const cmp = compareScenarios({ EXPECTED: expected, OPTIMISTIC: optimistic });
    expect(cmp.base).toBe('EXPECTED');
    expect(cmp.comparisons[0].modelVersion).toBe('THREE_STATEMENT_V1');
    expect(BigInt(cmp.comparisons[0].revenueDifferenceMinor) > 0n).toBe(true);
  });
});

describe('loan and capital classification', () => {
  it('keeps revenue independent of loan and capital injections', () => {
    const opening = {
      cash: '100000.00',
      receivables: '50000.00',
      inventory: '40000.00',
      fixedAssetsGross: '200000.00',
      accumulatedDepreciation: '50000.00',
      payables: '30000.00',
      longTermDebt: '100000.00',
      equity: '150000.00',
      retainedEarnings: '60000.00',
    };
    const base = projectThreeStatements({
      opening,
      baseRevenueMinor: parseToMinor('50000'),
      months: 1,
      assumptions: { grossMarginBps: 4000, opexPercentOfRevenueBps: 2000 },
    });
    const withFinancing = projectThreeStatements({
      opening,
      baseRevenueMinor: parseToMinor('50000'),
      months: 1,
      assumptions: {
        grossMarginBps: 4000,
        opexPercentOfRevenueBps: 2000,
        monthlyNewDebtMinor: 50000000,
        monthlyCapitalContributionMinor: 10000000,
      },
    });
    expect(withFinancing.periods[0].pnl.revenue.minor).toBe(base.periods[0].pnl.revenue.minor);
    expect(BigInt(withFinancing.periods[0].balanceSheet.cash.minor)).toBeGreaterThan(
      BigInt(base.periods[0].balanceSheet.cash.minor)
    );
  });
});
