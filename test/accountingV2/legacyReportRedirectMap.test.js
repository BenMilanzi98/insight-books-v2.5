import { describe, it, expect } from 'vitest';
import {
  mapLegacyReportIdToV2Type,
  buildReportsV2PathFromLegacyQuery,
  LEGACY_REPORT_TO_V2_TYPE,
} from '../../lib/accountingV2/reporting/legacyReportRedirectMap.js';
import { REPORT_TYPES } from '../../lib/accountingV2/reporting/reportContracts.js';

describe('legacyReportRedirectMap', () => {
  it('maps all primary legacy selector ids', () => {
    expect(mapLegacyReportIdToV2Type('profit-loss')).toBe(REPORT_TYPES.INCOME_STATEMENT);
    expect(mapLegacyReportIdToV2Type('balance-sheet')).toBe(REPORT_TYPES.BALANCE_SHEET);
    expect(mapLegacyReportIdToV2Type('cash-flow')).toBe(REPORT_TYPES.CASH_FLOW);
    expect(mapLegacyReportIdToV2Type('tax-summary')).toBe(REPORT_TYPES.TAXES);
    expect(mapLegacyReportIdToV2Type('stock-movement')).toBe(REPORT_TYPES.STOCK_MOVEMENTS);
    expect(mapLegacyReportIdToV2Type('inventory-loss-report')).toBe(REPORT_TYPES.INVENTORY_LOSS);
  });

  it('returns null for unknown legacy ids', () => {
    expect(mapLegacyReportIdToV2Type('not-a-report')).toBeNull();
    expect(mapLegacyReportIdToV2Type('')).toBeNull();
    expect(mapLegacyReportIdToV2Type(null)).toBeNull();
  });

  it('builds /reports-v2 path with type from ?report=', () => {
    expect(buildReportsV2PathFromLegacyQuery({ report: 'balance-sheet' })).toBe(
      '/reports-v2?type=BALANCE_SHEET'
    );
    expect(buildReportsV2PathFromLegacyQuery(new URLSearchParams('report=profit-loss'))).toBe(
      '/reports-v2?type=INCOME_STATEMENT'
    );
  });

  it('passes through bare V2 type values', () => {
    expect(buildReportsV2PathFromLegacyQuery({ type: 'CASH_FLOW' })).toBe(
      '/reports-v2?type=CASH_FLOW'
    );
  });

  it('defaults to /reports-v2 when no report param', () => {
    expect(buildReportsV2PathFromLegacyQuery({})).toBe('/reports-v2');
    expect(buildReportsV2PathFromLegacyQuery(null)).toBe('/reports-v2');
  });

  it('covers the ten catalog report keys', () => {
    const required = [
      'profit-loss',
      'profit-analysis',
      'balance-sheet',
      'cash-flow',
      'tax-summary',
      'sales-report',
      'expense-report',
      'stock-movement',
      'inventory-loss-report',
      'pos-daily',
    ];
    for (const id of required) {
      expect(LEGACY_REPORT_TO_V2_TYPE[id], id).toBeTruthy();
    }
  });
});
