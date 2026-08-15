/**
 * Phase 7 — report exports (CSV, XLSX, PDF).
 *
 * Exports mirror the on-screen report: same lines, period columns, hierarchy,
 * and totals. Headers use business name and human-readable dates only.
 */

import {
  buildExportHeaderRows,
  exportFilename,
  flattenReportLines,
  formatExportAmount,
  humanTotalLabel,
  indentLabel,
  isPercentLine,
  reportDisplayName,
} from './reportExportFormat.js';

export { exportFilename } from './reportExportFormat.js';

const CSV_INJECTION = /^[=+\-@\t\r]/;

/** Neutralize spreadsheet formula injection in text cells. */
export function sanitizeCell(value) {
  const text = String(value ?? '');
  return CSV_INJECTION.test(text) ? `'${text}` : text;
}

const csvEscape = (value) => {
  const text = sanitizeCell(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

function periodCell(line, periodIndex) {
  const pa = line.periodAmounts?.[periodIndex];
  const pct = isPercentLine(line);
  if (pct) {
    const p = pa?.percent ?? (pa?.amount?.decimal != null ? Number(pa.amount.decimal) : null);
    return formatExportAmount(null, { isPercent: true, percent: p });
  }
  return formatExportAmount(pa?.amount);
}

function lineAmountCellsAligned(line, envelope, columns) {
  const pct = isPercentLine(line);
  const cells = [];

  if (envelope.periods?.length) {
    for (let i = 0; i < envelope.periods.length; i += 1) cells.push(periodCell(line, i));
    cells.push(
      pct
        ? formatExportAmount(null, { isPercent: true, percent: line.percent })
        : formatExportAmount(line.currentAmount)
    );
    return cells;
  }

  cells.push(
    pct
      ? formatExportAmount(null, { isPercent: true, percent: line.percent })
      : formatExportAmount(line.currentAmount)
  );
  if (columns.includes('Comparative')) cells.push(formatExportAmount(line.comparativeAmount));
  if (columns.includes('Variance')) cells.push(formatExportAmount(line.varianceAmount));
  if (columns.includes('Budget')) cells.push(formatExportAmount(line.budgetAmount));
  if (columns.includes('Budget variance')) cells.push(formatExportAmount(line.budgetVariance));
  return cells;
}

function buildDynamicColumns(envelope, flatLines) {
  if (envelope.periods?.length) {
    return ['Line item', ...envelope.periods.map((p) => p.label), 'Total'];
  }

  const cols = ['Line item', 'Amount'];
  const hasComp = flatLines.some((f) => f.line.comparativeAmount?.decimal != null);
  const hasVar = flatLines.some((f) => f.line.varianceAmount?.decimal != null);
  const hasBudget = flatLines.some((f) => f.line.budgetAmount?.decimal != null);
  const hasBudgetVar = flatLines.some((f) => f.line.budgetVariance?.decimal != null);
  if (hasComp) cols.push('Comparative');
  if (hasVar) cols.push('Variance');
  if (hasBudget) cols.push('Budget');
  if (hasBudgetVar) cols.push('Budget variance');
  return cols;
}

function statementTable(envelope) {
  const flatLines = flattenReportLines(envelope.lines || []);
  const columns = buildDynamicColumns(envelope, flatLines);
  const rows = flatLines.map(({ line, depth }) => [
    indentLabel(depth, line.label),
    ...lineAmountCellsAligned(line, envelope, columns),
  ]);

  const totals = [];
  const skipTotalKeys = new Set([
    'grossMarginPercent',
    'netMarginPercent',
    'invoiceDocumentCount',
    'expenseDocumentCount',
  ]);
  const totalEntries = Object.entries(envelope.totals ?? {}).filter(([key, v]) => {
    if (skipTotalKeys.has(key)) return false;
    if (typeof v === 'number') return false;
    return v && typeof v === 'object' && ('decimal' in v || 'minor' in v || typeof v.percent === 'number');
  });
  for (const [key, v] of totalEntries) {
    if (typeof v.percent === 'number') {
      totals.push([humanTotalLabel(key), formatExportAmount(null, { isPercent: true, percent: v.percent })]);
    } else {
      totals.push([humanTotalLabel(key), formatExportAmount(v)]);
    }
  }

  return { columns, rows, totals };
}

function trialBalanceTable(envelope) {
  const columns = [
    'Account code',
    'Account name',
    'Opening Dr',
    'Opening Cr',
    'Period Dr',
    'Period Cr',
    'Closing Dr',
    'Closing Cr',
  ];
  const rows = (envelope.lines || []).map((r) => [
    r.accountCode ?? '',
    r.accountName ?? '',
    formatExportAmount(r.openingDebit),
    formatExportAmount(r.openingCredit),
    formatExportAmount(r.periodDebit),
    formatExportAmount(r.periodCredit),
    formatExportAmount(r.closingDebit),
    formatExportAmount(r.closingCredit),
  ]);
  const totals = [
    [
      '',
      'Totals',
      formatExportAmount(envelope.totals?.openingDebit),
      formatExportAmount(envelope.totals?.openingCredit),
      formatExportAmount(envelope.totals?.periodDebit),
      formatExportAmount(envelope.totals?.periodCredit),
      formatExportAmount(envelope.totals?.closingDebit),
      formatExportAmount(envelope.totals?.closingCredit),
    ],
  ];
  if (envelope.totals?.difference) {
    totals.push(['', 'Difference', '', '', '', '', '', formatExportAmount(envelope.totals.difference)]);
  }
  return { columns, rows, totals };
}

function buildReportTable(envelope) {
  if (envelope.reportType === 'TRIAL_BALANCE') return trialBalanceTable(envelope);
  return statementTable(envelope);
}

function padTotalRow(row, columnCount) {
  if (row.length >= columnCount) return row;
  return [...row, ...Array(columnCount - row.length).fill('')];
}

function parseNumericForExcel(value) {
  if (value === '' || value == null) return '';
  if (typeof value === 'number') return value;
  const s = String(value).trim();
  if (s.endsWith('%')) {
    const n = Number(s.slice(0, -1));
    return Number.isNaN(n) ? sanitizeCell(value) : n / 100;
  }
  const paren = /^\(([\d,]+\.?\d*)\)$/.exec(s);
  if (paren) return -Number(paren[1].replace(/,/g, ''));
  const n = Number(s.replace(/,/g, ''));
  return Number.isNaN(n) ? sanitizeCell(value) : n;
}

function isNumericColumn(header) {
  return /^(total|amount|comparative|variance|budget|opening|period|closing|dr|cr)/i.test(String(header));
}

function operationalInsightSections(envelope) {
  const ctx = envelope.operationalContext;
  if (!ctx) return [];

  const sections = [];

  if (ctx.topCustomers?.length) {
    sections.push({
      title: 'Top customers',
      columns: ['Customer', 'Amount'],
      rows: ctx.topCustomers.map((c) => [c.name ?? '', formatExportAmount({ decimal: c.amount })]),
    });
  }
  if (ctx.topProducts?.length) {
    sections.push({
      title: 'Top products',
      columns: ['Product', 'Amount'],
      rows: ctx.topProducts.map((p) => [p.name ?? '', formatExportAmount({ decimal: p.amount })]),
    });
  }
  if (ctx.byCategory?.length) {
    sections.push({
      title: 'By category',
      columns: ['Category', 'Amount'],
      rows: ctx.byCategory.map((c) => [c.category ?? '', formatExportAmount({ decimal: c.amount })]),
    });
  }
  if (ctx.largestExpenses?.length) {
    sections.push({
      title: 'Largest expenses',
      columns: ['Description', 'Amount'],
      rows: ctx.largestExpenses.map((e) => [e.description ?? e.name ?? '', formatExportAmount({ decimal: e.amount })]),
    });
  }
  if (ctx.productMovements?.length) {
    sections.push({
      title: 'Product movements',
      columns: ['Product', 'Quantity in', 'Quantity out', 'Net'],
      rows: ctx.productMovements.map((p) => [
        p.name ?? p.productName ?? '',
        p.qtyIn ?? p.quantityIn ?? '',
        p.qtyOut ?? p.quantityOut ?? '',
        p.net ?? p.netQty ?? '',
      ]),
    });
  }
  if (ctx.summary) {
    sections.push({
      title: 'Summary',
      columns: ['Metric', 'Value'],
      rows: Object.entries(ctx.summary).map(([k, v]) => [humanTotalLabel(k), String(v ?? '')]),
    });
  }
  if (ctx.latest) {
    sections.push({
      title: 'Latest POS day',
      columns: ['Metric', 'Value'],
      rows: [
        ['Total sales', formatExportAmount({ decimal: ctx.latest.totalSales })],
        ['Transactions', String(ctx.latest.transactionCount ?? '')],
      ],
    });
  }
  if (ctx.items?.length) {
    sections.push({
      title: 'Inventory loss items',
      columns: ['Item', 'Quantity', 'Value'],
      rows: ctx.items.slice(0, 100).map((i) => [
        i.name ?? i.productName ?? '',
        i.quantity ?? '',
        formatExportAmount({ decimal: i.value ?? i.amount }),
      ]),
    });
  }

  return sections;
}

function accountBreakdownRows(envelope) {
  const rows = [];
  const flat = flattenReportLines(envelope.lines || []);
  for (const { line } of flat) {
    for (const a of line.accounts || []) {
      rows.push([
        line.label ?? '',
        a.accountCode ?? '',
        a.accountName ?? '',
        formatExportAmount(a.amount),
      ]);
    }
  }
  return rows;
}

/** CSV export — matches on-screen report layout. */
export function exportReportToCsv(envelope, exportContext = {}) {
  const { columns, rows, totals } = buildReportTable(envelope);
  const out = [];
  for (const h of buildExportHeaderRows(envelope, exportContext)) out.push(h.map(csvEscape).join(','));
  out.push('');
  out.push(columns.map(csvEscape).join(','));
  for (const row of rows) out.push(row.map(csvEscape).join(','));
  for (const row of totals) out.push(padTotalRow(row, columns.length).map(csvEscape).join(','));

  const insights = operationalInsightSections(envelope);
  for (const section of insights) {
    out.push('');
    out.push(csvEscape(section.title));
    out.push(section.columns.map(csvEscape).join(','));
    for (const row of section.rows) out.push(row.map(csvEscape).join(','));
  }

  return out.join('\r\n');
}

/** Excel export — numeric cells, account detail and insights sheets. */
export async function exportReportToExcel(envelope, exportContext = {}) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = exportContext.businessName || 'InsightBooks';
  workbook.created = new Date();

  const info = workbook.addWorksheet('Report info');
  for (const [k, v] of buildExportHeaderRows(envelope, exportContext)) {
    info.addRow([sanitizeCell(k), sanitizeCell(v)]);
  }
  info.getColumn(1).width = 22;
  info.getColumn(2).width = 48;

  const sheet = workbook.addWorksheet('Report');
  const { columns, rows, totals } = buildReportTable(envelope);
  const headerRow = sheet.addRow(columns);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E407C' } };

  const numericIdx = new Set(columns.map((c, i) => (isNumericColumn(c) || i > 0 ? i : -1)).filter((i) => i >= 0));

  for (const row of rows) {
    sheet.addRow(
      row.map((cell, i) => (numericIdx.has(i) && i > 0 ? parseNumericForExcel(cell) : sanitizeCell(cell)))
    );
  }
  for (const row of totals) {
    const padded = padTotalRow(row, columns.length);
    const r = sheet.addRow(
      padded.map((cell, i) => (numericIdx.has(i) && i > 0 ? parseNumericForExcel(cell) : sanitizeCell(cell)))
    );
    r.font = { bold: true };
  }
  sheet.columns.forEach((col, i) => {
    col.width = i === 0 ? 42 : 16;
  });

  const breakdown = accountBreakdownRows(envelope);
  if (breakdown.length) {
    const accounts = workbook.addWorksheet('Account detail');
    accounts.addRow(['Line item', 'Account code', 'Account name', 'Amount']).font = { bold: true };
    for (const row of breakdown) {
      accounts.addRow([
        sanitizeCell(row[0]),
        sanitizeCell(row[1]),
        sanitizeCell(row[2]),
        parseNumericForExcel(row[3]),
      ]);
    }
    accounts.getColumn(1).width = 36;
    accounts.getColumn(4).numFmt = '#,##0.00';
  }

  const insights = operationalInsightSections(envelope);
  if (insights.length) {
    const insightSheet = workbook.addWorksheet('Insights');
    let rowNum = 1;
    for (const section of insights) {
      insightSheet.getCell(rowNum, 1).value = section.title;
      insightSheet.getCell(rowNum, 1).font = { bold: true };
      rowNum += 1;
      insightSheet.addRow(section.columns).font = { bold: true };
      rowNum += 1;
      for (const row of section.rows) {
        insightSheet.addRow(row.map((c, i) => (i > 0 && section.columns[i]?.toLowerCase().includes('amount') ? parseNumericForExcel(c) : sanitizeCell(c))));
        rowNum += 1;
      }
      rowNum += 1;
    }
  }

  return workbook.xlsx.writeBuffer();
}

/** PDF export — landscape statement with clean header. */
export async function exportReportToPdf(envelope, exportContext = {}) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape' });
  const businessName = exportContext.businessName || 'Business';
  const title = reportDisplayName(envelope, exportContext);

  doc.setFontSize(16);
  doc.setTextColor(30, 64, 124);
  doc.text(businessName, 14, 16);
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 14, 24);

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  let y = 30;
  for (const [k, v] of buildExportHeaderRows(envelope, exportContext)) {
    if (k === 'Report') continue;
    doc.text(`${k}: ${v}`, 14, y);
    y += 5;
  }

  const { columns, rows, totals } = buildReportTable(envelope);
  const body = [...rows];
  for (const row of totals) body.push(padTotalRow(row, columns.length));

  autoTable(doc, {
    startY: y + 3,
    head: [columns],
    body: body.map((r) => r.map((c) => String(c ?? ''))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 64, 124], textColor: 255 },
    columnStyles: { 0: { cellWidth: 70 } },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index > 0) {
        const raw = String(data.cell.raw ?? '');
        if (/^\([\d,.]+\)$/.test(raw)) data.cell.styles.textColor = [185, 28, 28];
      }
    },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `${title} · ${envelope.currency || 'MWK'} · Page ${i} of ${pageCount}`,
      14,
      doc.internal.pageSize.getHeight() - 8
    );
  }
  return Buffer.from(doc.output('arraybuffer'));
}
