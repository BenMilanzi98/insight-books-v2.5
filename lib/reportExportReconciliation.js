/**
 * Append GL vs operational reconciliation rows to CSV / Excel exports.
 */
import {
  buildExpenseReconciliation,
  buildSalesReconciliation,
  getGlPeriodTotals,
} from '@/lib/reportingEngine/index.js';

export const RECONCILIATION_COLUMN_HEADERS = [
  { key: 'glAmount', label: 'General Ledger' },
  { key: 'operationalAmount', label: 'Operational' },
  { key: 'variance', label: 'Variance' },
  { key: 'reconciled', label: 'Reconciled' },
];

export function mergeReconciliationColumnHeaders(headers) {
  const keys = new Set(headers.map((h) => h.key));
  const extras = RECONCILIATION_COLUMN_HEADERS.filter((h) => !keys.has(h.key));
  return extras.length ? [...headers, ...extras] : headers;
}

export async function fetchSalesExportReconciliation({
  tenantId,
  startDate,
  endDate,
  branchId = null,
  operationalRevenue,
  prisma,
}) {
  try {
    const glTotals = await getGlPeriodTotals({
      tenantId,
      startDate,
      endDate,
      branchId,
      prisma,
    });
    return glTotals ? buildSalesReconciliation(operationalRevenue, glTotals) : null;
  } catch (err) {
    console.warn('Sales export: GL reconciliation failed', err?.message || err);
    return null;
  }
}

export async function fetchExpenseExportReconciliation({
  tenantId,
  startDate,
  endDate,
  branchId = null,
  operationalTotal,
  prisma,
}) {
  try {
    const glTotals = await getGlPeriodTotals({
      tenantId,
      startDate,
      endDate,
      branchId,
      prisma,
    });
    return glTotals ? buildExpenseReconciliation(operationalTotal, glTotals) : null;
  } catch (err) {
    console.warn('Expense export: GL reconciliation failed', err?.message || err);
    return null;
  }
}

export function flattenReconciliationForExport(reconciliation) {
  if (!reconciliation?.items?.length) return [];
  return reconciliation.items.map((item) => ({
    section: 'GL Reconciliation',
    label: item.label,
    glAmount: Number(item.glAmount) || 0,
    operationalAmount: Number(item.operationalAmount) || 0,
    variance: Number(item.variance) || 0,
    reconciled: item.reconciled ? 'Yes' : 'No',
  }));
}

export const RECONCILIATION_EXPORT_HEADERS = [
  { key: 'section', label: 'Section' },
  { key: 'label', label: 'Line' },
  { key: 'glAmount', label: 'General Ledger' },
  { key: 'operationalAmount', label: 'Operational' },
  { key: 'variance', label: 'Variance' },
  { key: 'reconciled', label: 'Reconciled' },
];

/**
 * @param {import('exceljs').Worksheet} ws
 * @param {number} startRow
 * @param {{ items?: Array<{ label: string, glAmount: number, operationalAmount: number, variance: number, reconciled: boolean }> }} reconciliation
 * @returns {number} next row number
 */
export function appendReconciliationToExcelWorksheet(ws, startRow, reconciliation) {
  if (!reconciliation?.items?.length) return startRow;

  let rowNum = startRow + 1;
  const titleRow = ws.getRow(rowNum++);
  titleRow.getCell(1).value = 'General Ledger Reconciliation';
  titleRow.getCell(1).font = { bold: true, size: 12 };

  const headerRow = ws.getRow(rowNum++);
  ['Line', 'General Ledger', 'Operational', 'Variance', 'Reconciled'].forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true };
  });

  const currencyNumFmt = '#,##0.00;(#,##0.00)';
  for (const item of reconciliation.items) {
    const r = ws.getRow(rowNum++);
    r.getCell(1).value = item.label;
    [item.glAmount, item.operationalAmount, item.variance].forEach((val, idx) => {
      const cell = r.getCell(idx + 2);
      cell.value = Number(val) || 0;
      cell.numFmt = currencyNumFmt;
      cell.alignment = { horizontal: 'right' };
    });
    r.getCell(5).value = item.reconciled ? 'Yes' : 'No';
  }

  return rowNum;
}

export function appendReconciliationRowsForHeaders(reportData, headers, reconciliation) {
  if (!reconciliation?.items?.length || !Array.isArray(reportData)) return reportData;

  const labelKey =
    headers.find((h) =>
      ['description', 'section', 'category', 'label', 'metric', 'type', 'customer'].includes(h.key)
    )?.key || headers[0]?.key;
  const glKey = headers.find((h) => h.key === 'glAmount')?.key;
  const opKey = headers.find((h) => h.key === 'operationalAmount')?.key;
  const varianceKey = headers.find((h) => h.key === 'variance')?.key;
  const amountKey =
    varianceKey ||
    headers.find((h) => ['amount', 'balance', 'value', 'total'].includes(h.key))?.key ||
    null;

  const spacer = {};
  headers.forEach((h) => {
    spacer[h.key] = '';
  });
  if (labelKey) spacer[labelKey] = '— GL Reconciliation —';

  const rows = [spacer];
  for (const item of reconciliation.items) {
    const row = { ...spacer };
    if (labelKey) row[labelKey] = item.label;
    if (glKey) row[glKey] = item.glAmount;
    if (opKey) row[opKey] = item.operationalAmount;
    if (amountKey) row[amountKey] = item.variance;
    if ('reconciled' in spacer || headers.some((h) => h.key === 'reconciled')) {
      row.reconciled = item.reconciled ? 'Yes' : 'No';
    }
    rows.push(row);
  }

  return [...reportData, ...rows];
}
