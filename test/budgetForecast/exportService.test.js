import { describe, it, expect } from 'vitest';
import { rowsForExport } from '../../lib/budgetForecast/application/exportService.js';

describe('rowsForExport', () => {
  it('uses pnlGrouped rows for BUDGET plan exports with section and calculated totals', () => {
    const rows = rowsForExport({
      reportId: 'BUDGET',
      pnlGrouped: {
        rows: [
          { rowType: 'SECTION', label: 'Income — Sales / Revenue' },
          {
            rowType: 'ACCOUNT',
            accountCode: '4010',
            accountName: 'Product sales',
            budget: 300,
          },
          { rowType: 'CALCULATED', label: 'Net Profit', budget: 150 },
        ],
      },
    });

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ type: 'section', label: 'Income — Sales / Revenue' });
    expect(rows[1]).toMatchObject({
      type: 'account',
      label: '4010 Product sales',
      budget: 300,
    });
    expect(rows[2]).toMatchObject({ type: 'total', label: 'Net Profit', budget: 150 });
  });

  it('falls back to flat lines when pnlGrouped is absent', () => {
    const rows = rowsForExport({
      lines: [{ accountCode: '4000', accountName: 'Sales', budget: 1000 }],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('4000 Sales');
    expect(rows[0].budget).toBe(1000);
  });
});
