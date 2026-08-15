import { describe, expect, it } from 'vitest';
import { filterConfigForReportType, rangeFromPreset } from '../lib/reports/reportDatePresets.js';

describe('filterConfigForReportType', () => {
  it('gives P&L the FreshBooks filter set', () => {
    expect(filterConfigForReportType('INCOME_STATEMENT')).toEqual({
      asOf: false,
      groupBy: true,
      basis: true,
      breakdown: true,
      currency: false,
      includeZero: false,
    });
  });

  it('uses as-of date for the balance sheet', () => {
    expect(filterConfigForReportType('BALANCE_SHEET').asOf).toBe(true);
    expect(filterConfigForReportType('BALANCE_SHEET').groupBy).toBe(false);
  });

  it('does not advertise month grouping for cash flow', () => {
    expect(filterConfigForReportType('CASH_FLOW').groupBy).toBe(false);
  });

  it('dashboard shows date filter only', () => {
    expect(filterConfigForReportType('REPORTS_DASHBOARD')).toEqual({
      asOf: false,
      groupBy: false,
      basis: false,
      breakdown: false,
      currency: false,
      includeZero: false,
    });
  });
});

describe('DATE_PRESETS', () => {
  it('includes today, this week, and this month', async () => {
    const { DATE_PRESETS } = await import('../lib/reports/reportDatePresets.js');
    const ids = DATE_PRESETS.map((p) => p.id);
    expect(ids).toContain('today');
    expect(ids).toContain('thisWeek');
    expect(ids).toContain('thisMonth');
    expect(ids).toContain('lastWeek');
    expect(ids).toContain('lastYear');
    expect(ids).toContain('custom');
  });
});

describe('rangeFromPreset', () => {
  it('returns a from/to pair for thisYear', () => {
    const range = rangeFromPreset('thisYear');
    expect(range.fromDate).toMatch(/^\d{4}-01-01$/);
    expect(range.toDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('maps legacy this_year alias', () => {
    const range = rangeFromPreset('this_year');
    expect(range.fromDate).toMatch(/^\d{4}-01-01$/);
  });

  it('returns this month bounds', () => {
    const range = rangeFromPreset('thisMonth');
    expect(range.fromDate).toMatch(/^\d{4}-\d{2}-01$/);
  });
});
