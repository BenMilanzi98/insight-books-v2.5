/**
 * Human-readable formatting for report exports (CSV, XLSX, PDF).
 */

import { findReportByType } from '@/lib/reports/reportCatalog';

const TOTAL_LABELS = Object.freeze({
  netProfit: 'Net profit',
  revenue: 'Revenue',
  grossProfit: 'Gross profit',
  operatingProfit: 'Operating profit',
  profitBeforeTax: 'Net profit before tax',
  ebitda: 'EBITDA',
  totalAssets: 'Total assets',
  totalLiabilities: 'Total liabilities',
  totalEquity: 'Total equity',
  totalLiabilitiesAndEquity: 'Total liabilities and equity',
  netCashFlow: 'Net cash flow',
  closingCashBalance: 'Closing cash balance',
  expenses: 'Total expenses',
  cogs: 'Cost of goods sold',
  salesTax: 'Sales tax',
  openingDebit: 'Opening debit',
  openingCredit: 'Opening credit',
  periodDebit: 'Period debit',
  periodCredit: 'Period credit',
  closingDebit: 'Closing debit',
  closingCredit: 'Closing credit',
  difference: 'Difference',
});

const AS_OF_REPORT_TYPES = new Set(['BALANCE_SHEET', 'RECEIVABLES', 'PAYABLES']);

/** @param {string|null|undefined} iso */
export function formatExportDate(iso) {
  if (!iso) return '';
  const raw = String(iso);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function reportDisplayName(envelope, exportContext = {}) {
  if (exportContext.reportDisplayName) return exportContext.reportDisplayName;
  const fromCatalog = findReportByType(envelope.reportType);
  if (fromCatalog?.name) return fromCatalog.name;
  return envelope.reportName || envelope.reportType || 'Report';
}

export function humanTotalLabel(key) {
  if (!key) return '';
  if (TOTAL_LABELS[key]) return TOTAL_LABELS[key];
  return String(key)
    .replace(/([A-Z])/g, ' $1')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

export function isPercentLine(line) {
  return Boolean(
    line?.isPercent ||
      line?.lineType === 'RATIO' ||
      line?.lineId === 'gross-margin' ||
      line?.lineId === 'net-margin'
  );
}

/** @param {object|null|undefined} amountObj */
export function formatExportAmount(amountObj, { isPercent = false, percent = null } = {}) {
  if (isPercent || amountObj?.isPercent) {
    const p = percent ?? amountObj?.percent ?? Number(amountObj?.decimal);
    if (p == null || Number.isNaN(Number(p))) return '';
    return `${Number(p)}%`;
  }
  if (amountObj == null) return '';
  const n = Number(amountObj.decimal ?? amountObj);
  if (Number.isNaN(n)) return '';
  if (n < 0) {
    return `(${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  }
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function indentLabel(depth, label) {
  const pad = depth > 0 ? `${'  '.repeat(depth)}` : '';
  return `${pad}${label ?? ''}`;
}

/**
 * Clean export header rows — business name, readable dates, report options only.
 * @param {object} envelope
 * @param {object} exportContext
 * @returns {[string, string][]}
 */
export function buildExportHeaderRows(envelope, exportContext = {}) {
  const rows = [];
  const meta = envelope.meta || {};

  rows.push(['Report', reportDisplayName(envelope, exportContext)]);
  rows.push(['Business', exportContext.businessName || 'Business']);

  const asOf = AS_OF_REPORT_TYPES.has(envelope.reportType) || Boolean(meta.asOf);
  if (asOf) {
    rows.push(['As of', formatExportDate(envelope.asOfDate || envelope.dateRange?.toDate)]);
  } else {
    const from = formatExportDate(envelope.dateRange?.fromDate);
    const to = formatExportDate(envelope.dateRange?.toDate);
    if (from && to) rows.push(['Period', `${from} — ${to}`]);
    else if (to) rows.push(['Period', to]);
  }

  if (envelope.periods?.length) {
    rows.push(['Columns', envelope.periods.map((p) => p.label).join(', ')]);
  }

  if (meta.accountingMethod === 'CASH') {
    rows.push(['Accounting method', 'Collected (Cash-Based)']);
  } else if (meta.accountingMethod === 'ACCRUAL') {
    rows.push(['Accounting method', 'Billed (Accrual)']);
  } else if (envelope.reportBasis === 'CASH') {
    rows.push(['Accounting method', 'Collected (Cash-Based)']);
  } else if (envelope.reportBasis === 'ACCRUAL') {
    rows.push(['Accounting method', 'Billed (Accrual)']);
  }

  if (meta.groupBy === 'MONTH') rows.push(['Grouped by', 'Month']);
  else if (meta.groupBy === 'QUARTER') rows.push(['Grouped by', 'Quarter']);
  else if (envelope.groupBy === 'MONTH') rows.push(['Grouped by', 'Month']);
  else if (envelope.groupBy === 'QUARTER') rows.push(['Grouped by', 'Quarter']);

  if (meta.breakdown === 'SOURCE_TYPE') rows.push(['Breakdown', 'By transaction type']);
  else if (meta.breakdown === 'ACCOUNT') rows.push(['Breakdown', 'By account']);

  rows.push(['Currency', envelope.currency || 'MWK']);
  rows.push(['Generated', formatExportDate(envelope.generatedAt || new Date().toISOString())]);

  return rows;
}

/** Flatten hierarchical report lines (sections + account children). */
export function flattenReportLines(lines, depth = 0) {
  const out = [];
  for (const line of lines || []) {
    out.push({ line, depth });
    if (Array.isArray(line.children) && line.children.length) {
      out.push(...flattenReportLines(line.children, depth + 1));
    }
  }
  return out;
}

export function exportFilename(envelope, format, exportContext = {}) {
  const title = reportDisplayName(envelope, exportContext)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const date = formatExportDate(envelope.dateRange?.toDate || envelope.asOfDate || envelope.generatedAt)
    .replace(/\s+/g, '-')
    .replace(/,/g, '');
  return `${title || 'report'}_${date || 'export'}.${format}`;
}
