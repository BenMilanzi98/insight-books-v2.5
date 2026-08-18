import { describe, it, expect } from 'vitest';
import { buildPnlVarianceLayout, buildVarianceInsight } from '../../lib/budgetForecast/domain/pnlVarianceLayout.js';

describe('buildPnlVarianceLayout', () => {
  const varianceLines = [
    {
      accountId: 'a1',
      accountCode: '4010',
      accountName: 'Sales',
      kind: 'REVENUE',
      budget: 50,
      actual: 55,
      favourableVarianceMinor: 500,
    },
    {
      accountId: 'a2',
      accountCode: '5100',
      accountName: 'COGS',
      kind: 'COST_OF_SALES',
      budget: 20,
      actual: 22,
      favourableVarianceMinor: -200,
    },
    {
      accountId: 'a3',
      accountCode: '5210',
      accountName: 'Rent',
      kind: 'EXPENSE',
      budget: 10,
      actual: 10,
      favourableVarianceMinor: 0,
    },
  ];

  it('groups lines into P&L sections with calculated profit rows', () => {
    const { rows } = buildPnlVarianceLayout({ varianceLines });
    expect(rows.some((r) => r.rowType === 'SECTION' && r.lineId === 'revenue')).toBe(true);
    expect(rows.some((r) => r.rowType === 'CALCULATED' && r.lineId === 'net-profit')).toBe(true);
  });

  it('computes net profit variance in summary', () => {
    const { summary } = buildPnlVarianceLayout({ varianceLines });
    expect(summary.grossProfit.budget).toBe(30);
    expect(summary.grossProfit.actual).toBe(33);
    expect(summary.netProfit.variance).toBe(3);
  });
});

describe('buildVarianceInsight', () => {
  it('returns readable insight text', () => {
    const text = buildVarianceInsight({
      netProfit: { variance: 3 },
      revenue: { variance: 5 },
      operatingExpenses: { variance: 0 },
    });
    expect(text).toContain('Net profit');
    expect(text).toContain('Revenue');
  });
});
