/**
 * Export Budget & Forecast reports as Excel or PDF.
 */
import { fromMinor } from '../domain/money.js';

function fmtMoney(n, currency = 'MWK') {
  const v = Number(n) || 0;
  return `${currency} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function periodLabel(report) {
  const p = report.period;
  if (!p?.startDate || !p?.endDate) return 'Full period';
  const s = new Date(p.startDate).toLocaleDateString('en-GB');
  const e = new Date(p.endDate).toLocaleDateString('en-GB');
  return s === e ? s : `${s} — ${e}`;
}

/** Normalize export rows from pnlGrouped or flat lines. */
export function rowsForExport(report) {
  const pnl = report.pnlGrouped?.rows;
  if (Array.isArray(pnl) && pnl.length) {
    return pnl.map((row) => {
      if (row.rowType === 'SECTION') {
        return {
          type: 'section',
          label: row.label,
          budget: '',
          actual: '',
          variance: '',
        };
      }
      if (row.rowType === 'CALCULATED') {
        return {
          type: 'total',
          label: row.label,
          budget: row.budget ?? row.total ?? 0,
          actual: row.actual ?? '',
          variance: row.variance ?? '',
        };
      }
      return {
        type: 'account',
        label: row.accountName
          ? `${row.accountCode || row.code || ''} ${row.accountName}`.trim()
          : row.label,
        budget: row.budget ?? row.total ?? 0,
        actual: row.actual ?? '',
        variance: row.variance ?? '',
      };
    });
  }

  return (report.lines || []).map((line) => ({
    type: 'account',
    label: `${line.accountCode || ''} ${line.accountName || ''}`.trim(),
    budget: line.budget ?? fromMinor(line.budgetMinor || 0),
    actual: line.actual ?? line.forecast ?? fromMinor(line.actualMinor ?? line.forecastMinor ?? 0),
    variance: fromMinor(line.favourableVarianceMinor ?? 0),
  }));
}

/**
 * Build a projection-shaped report from forecast + P&L layout summary.
 */
export function buildForecastProjectionExportPayload(forecast, pnlGrouped, { businessName = 'Business' } = {}) {
  const summary = pnlGrouped?.summary || {};
  return {
    reportId: 'PROJECTION',
    name: 'Financial Projection',
    businessName,
    currency: forecast.currency || 'MWK',
    period: { startDate: forecast.startDate, endDate: forecast.endDate },
    forecast: {
      name: forecast.name,
      scenarioType: forecast.scenarioType,
      forecastType: forecast.forecastType,
      calculationVersion: forecast.calculationVersion,
    },
    assumptions: {
      scenario: forecast.scenarioType,
      type: forecast.forecastType,
      sourceBudgetId: forecast.sourceBudgetId || null,
    },
    insight: `Projected net profit: ${fmtMoney(summary.netProfit ?? summary.profit ?? 0, forecast.currency)}`,
    pnlGrouped,
    totals: {
      revenue: summary.revenue ?? 0,
      grossProfit: summary.grossProfit ?? 0,
      netProfit: summary.netProfit ?? summary.profit ?? 0,
    },
  };
}

export async function exportReportAsExcel(report, { businessName = 'Business' } = {}) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'InsightBooks';
  wb.created = new Date();

  const currency = report.currency || 'MWK';
  const rows = rowsForExport(report);

  const meta = wb.addWorksheet('Cover');
  meta.addRow(['Financial Report']);
  meta.addRow(['Business', businessName]);
  meta.addRow(['Report', report.name || report.reportId]);
  meta.addRow(['Period', periodLabel(report)]);
  meta.addRow(['Currency', currency]);
  meta.addRow(['Generated', new Date().toLocaleString('en-GB')]);
  if (report.insight) meta.addRow(['Summary', report.insight]);
  meta.addRow([]);
  meta.addRow(['Disclaimer', 'Planning document — not posted to the General Ledger.']);

  if (report.assumptions && typeof report.assumptions === 'object') {
    meta.addRow([]);
    meta.addRow(['Assumptions']);
    for (const [k, v] of Object.entries(report.assumptions)) {
      meta.addRow([k, v == null ? '' : String(v)]);
    }
  }

  const sheet = wb.addWorksheet('P&L');
  const hasVariance = rows.some((r) => r.variance !== '' && r.variance != null);
  sheet.addRow(hasVariance ? ['Line', 'Budget', 'Actual', 'Variance'] : ['Line', 'Projected']);

  for (const row of rows) {
    if (row.type === 'section') {
      sheet.addRow([row.label.toUpperCase(), '', '', '']);
    } else if (hasVariance) {
      sheet.addRow([row.label, row.budget, row.actual, row.variance]);
    } else {
      sheet.addRow([row.label, row.budget || row.actual]);
    }
  }

  if (report.totals) {
    sheet.addRow([]);
    sheet.addRow(['Totals', report.totals.budget, report.totals.actual, report.totals.rawVariance]);
  }

  const buffer = await wb.xlsx.writeBuffer();
  const slug = String(report.reportId || 'report').toLowerCase();
  return {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `${slug}-${Date.now()}.xlsx`,
    body: Buffer.from(buffer),
  };
}

export async function exportReportAsPdf(report, { businessName = 'Business' } = {}) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const currency = report.currency || 'MWK';
  const margin = 48;
  let y = margin;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(businessName, margin, y);
  y += 22;

  doc.setFontSize(14);
  doc.text(report.name || 'Financial Report', margin, y);
  y += 18;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${periodLabel(report)}`, margin, y);
  y += 14;
  doc.text(`Currency: ${currency}`, margin, y);
  y += 14;
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, margin, y);
  y += 18;

  if (report.insight) {
    doc.setFont('helvetica', 'italic');
    doc.text(report.insight, margin, y, { maxWidth: 500 });
    y += 24;
  }

  if (report.assumptions && typeof report.assumptions === 'object') {
    doc.setFont('helvetica', 'bold');
    doc.text('Assumptions', margin, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    for (const [k, v] of Object.entries(report.assumptions)) {
      doc.text(`${k}: ${v == null ? '—' : String(v)}`, margin, y, { maxWidth: 500 });
      y += 12;
    }
    y += 8;
  }

  const rows = rowsForExport(report);
  const hasVariance = rows.some((r) => r.variance !== '' && r.variance != null);

  const body = [];
  for (const row of rows) {
    if (row.type === 'section') {
      body.push([
        { content: row.label.toUpperCase(), colSpan: hasVariance ? 4 : 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
      ]);
    } else {
      body.push(
        hasVariance
          ? [
              row.label,
              fmtMoney(row.budget, currency),
              fmtMoney(row.actual, currency),
              fmtMoney(row.variance, currency),
            ]
          : [row.label, fmtMoney(row.budget || row.actual, currency)]
      );
    }
  }

  autoTable(doc, {
    startY: y,
    head: [hasVariance ? ['Account / Section', 'Budget', 'Actual', 'Variance'] : ['Account / Section', 'Projected']],
    body,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [79, 70, 229] },
  });

  const finalY = doc.lastAutoTable?.finalY || y + 20;
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(
    'This projection is for planning purposes only and has not been posted to your accounts.',
    margin,
    finalY + 24,
    { maxWidth: 500 }
  );

  const slug = String(report.reportId || 'report').toLowerCase();
  return {
    contentType: 'application/pdf',
    filename: `${slug}-${Date.now()}.pdf`,
    body: Buffer.from(doc.output('arraybuffer')),
  };
}
