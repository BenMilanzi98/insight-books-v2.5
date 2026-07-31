/**
 * R3-C — map legacy `/reports?report=` ids to Accounting V2 `/reports-v2?type=` types.
 * Financial money authority is V2 JE-only (R1-B).
 */

import { REPORT_TYPES } from './reportTypes.js';

/** @type {Readonly<Record<string, string>>} */
export const LEGACY_REPORT_TO_V2_TYPE = Object.freeze({
  'profit-loss': REPORT_TYPES.INCOME_STATEMENT,
  'profit-and-loss': REPORT_TYPES.INCOME_STATEMENT,
  'income-statement': REPORT_TYPES.INCOME_STATEMENT,
  'profit-analysis': REPORT_TYPES.PROFIT_ANALYSIS,
  'balance-sheet': REPORT_TYPES.BALANCE_SHEET,
  'cash-flow': REPORT_TYPES.CASH_FLOW,
  'tax-summary': REPORT_TYPES.TAXES,
  'sales-report': REPORT_TYPES.SALES,
  sales: REPORT_TYPES.SALES,
  'expense-report': REPORT_TYPES.EXPENSES,
  expenses: REPORT_TYPES.EXPENSES,
  'stock-movement': REPORT_TYPES.STOCK_MOVEMENTS,
  'inventory-loss-report': REPORT_TYPES.INVENTORY_LOSS,
  'pos-daily': REPORT_TYPES.DAILY_POS,
  'trial-balance': REPORT_TYPES.TRIAL_BALANCE,
  'financial-ratios': REPORT_TYPES.INCOME_STATEMENT,
});

/**
 * @param {string|null|undefined} legacyReportId
 * @returns {string|null} V2 report type or null if unknown / absent
 */
export function mapLegacyReportIdToV2Type(legacyReportId) {
  if (legacyReportId == null || legacyReportId === '') return null;
  const key = String(legacyReportId).trim().toLowerCase();
  return LEGACY_REPORT_TO_V2_TYPE[key] ?? null;
}

/**
 * @param {Record<string, string | string[] | undefined> | URLSearchParams | null | undefined} searchParams
 * @returns {string} path including query, e.g. `/reports-v2` or `/reports-v2?type=BALANCE_SHEET`
 */
export function buildReportsV2PathFromLegacyQuery(searchParams) {
  let legacyId = null;
  if (searchParams instanceof URLSearchParams) {
    legacyId = searchParams.get('report') || searchParams.get('type');
  } else if (searchParams && typeof searchParams === 'object') {
    const raw = searchParams.report ?? searchParams.type;
    legacyId = Array.isArray(raw) ? raw[0] : raw;
  }

  // Already a V2 type?
  const asV2 = String(legacyId || '').toUpperCase();
  if (legacyId && Object.values(REPORT_TYPES).includes(asV2)) {
    return `/reports-v2?type=${encodeURIComponent(asV2)}`;
  }

  const mapped = mapLegacyReportIdToV2Type(legacyId);
  if (mapped) {
    return `/reports-v2?type=${encodeURIComponent(mapped)}`;
  }
  return '/reports-v2';
}
