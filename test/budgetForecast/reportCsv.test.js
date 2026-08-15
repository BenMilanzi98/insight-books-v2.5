import { describe, it, expect } from 'vitest';
import { exportReportAsCsv } from '../../lib/budgetForecast/application/reportService.js';

describe('report CSV export', () => {
  it('includes metadata and reconciles line values', async () => {
    const report = {
      reportId: 'BUDGET_VS_ACTUAL',
      budget: { versionNumber: 2 },
      freshness: '2026-07-24T00:00:00.000Z',
      currency: 'MWK',
      lines: [
        {
          accountCode: '4000',
          accountName: 'Sales',
          category: 'REVENUE',
          budget: 1000,
          actual: 900,
          rawVarianceMinor: -10000,
          favourableVarianceMinor: -10000,
          variancePercent: -10,
          status: 'BELOW_TARGET',
        },
      ],
    };
    const csv = await exportReportAsCsv(report, { businessName: 'Acme Ltd' });
    expect(csv).toContain('"Report"');
    expect(csv).toContain('Acme Ltd');
    expect(csv).toContain('MWK');
    expect(csv).toContain('4000');
    expect(csv).toContain('1000');
    expect(csv).toContain('900');
  });
});
