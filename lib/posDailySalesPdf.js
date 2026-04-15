/**
 * Daily POS sales PDF — A4 portrait, branded header, KPI strip, transaction table.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrencyForExport } from './invoiceCalculations';
import {
  buildPosDailyLineItemHeadersWithCurrency,
  buildPosDailyLineItemDataRows,
} from './posDailySalesLineItemsExport';

const ACCENT = [67, 56, 202]; // indigo-600
const ACCENT_LIGHT = [238, 242, 255];
const SLATE_700 = [51, 65, 85];
const SLATE_500 = [100, 116, 139];

function fmtMoney(amount, currencyCode = 'MWK') {
  return formatCurrencyForExport(Number(amount) || 0, currencyCode);
}

function fmtUtcDateTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  } catch {
    return String(iso);
  }
}

function drawFooterPageNumbers(doc, margin) {
  const pageCount = doc.internal.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const rightX = pageW - margin;
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(SLATE_500[0], SLATE_500[1], SLATE_500[2]);
    doc.text('Daily POS Sales', margin, pageH - 8);
    doc.text(`Page ${i} of ${pageCount}`, rightX, pageH - 8, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }
}

/**
 * @param {object} report - generatePosDailyReport result
 * @param {object|null} cashState - getPosCashDayState result or null
 * @param {{ date?: string, currencyCode?: string }} [opts]
 * @returns {Buffer}
 */
export function generatePosDailySalesPdfBuffer(report, cashState, opts = {}) {
  const date = opts.date || report?.date || '';
  const currency = opts.currencyCode || report?.currencyCode || 'MWK';
  const company = report?.companyName || 'Company';
  const generated = new Date().toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentW = pageW - margin * 2;

  // Header bar
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(0, 0, pageW, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(company, margin, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Daily POS Sales Report', margin, 23);
  doc.setFontSize(8);
  doc.text(`Generated ${generated}`, pageW - margin, 23, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  let y = 40;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(SLATE_700[0], SLATE_700[1], SLATE_700[2]);
  doc.text('Report date', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(date || '—', margin + 32, y);
  y += 10;

  // KPI cards (2x2)
  const txs = report?.transactions || [];
  const totalSales = Number(report?.totalSales ?? 0);
  const txCount = Number(report?.transactionCount ?? txs.length);
  const opening = cashState?.metrics?.openingBalance;
  const closing = cashState?.metrics?.closingBalance;
  const hasOpening = opening != null && opening !== '' && !Number.isNaN(Number(opening));
  const hasClosing = closing != null && closing !== '' && !Number.isNaN(Number(closing));

  const kpi = [
    { label: 'Total sales', value: fmtMoney(totalSales, currency) },
    { label: 'Transactions', value: String(txCount) },
    {
      label: 'Opening (register)',
      value: hasOpening ? fmtMoney(opening, currency) : '—',
    },
    {
      label: 'Closing (opening + sales)',
      value: hasClosing ? fmtMoney(closing, currency) : '—',
    },
  ];

  const gap = 4;
  const cardW = (contentW - gap) / 2;
  const cardH = 18;
  const cy = y;
  for (let i = 0; i < kpi.length; i += 1) {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const x = margin + col * (cardW + gap);
    const yy = cy + row * (cardH + gap);
    doc.setFillColor(ACCENT_LIGHT[0], ACCENT_LIGHT[1], ACCENT_LIGHT[2]);
    doc.setDrawColor(199, 210, 254);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, yy, cardW, cardH, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(SLATE_500[0], SLATE_500[1], SLATE_500[2]);
    doc.text(kpi[i].label, x + 3, yy + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(SLATE_700[0], SLATE_700[1], SLATE_700[2]);
    const lines = doc.splitTextToSize(kpi[i].value, cardW - 6);
    doc.text(lines, x + 3, yy + 13);
    doc.setTextColor(0, 0, 0);
  }
  y = cy + 2 * (cardH + gap) + gap + 6;

  // Optional payment mix
  const breakdown = report?.paymentBreakdown || [];
  if (breakdown.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(SLATE_700[0], SLATE_700[1], SLATE_700[2]);
    doc.text('Payment mix (by method)', margin, y);
    y += 5;
    const mixRows = breakdown.map((p) => [
      String(p.label || '—'),
      fmtMoney(p.total ?? 0, currency),
    ]);
    autoTable(doc, {
      startY: y,
      head: [['Method', 'Amount']],
      body: mixRows,
      theme: 'plain',
      headStyles: {
        fillColor: ACCENT,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9, textColor: SLATE_700 },
      columnStyles: {
        0: { cellWidth: contentW * 0.55 },
        1: { cellWidth: contentW * 0.45, halign: 'right' },
      },
      margin: { left: margin, right: margin },
      tableLineColor: [226, 232, 240],
      tableLineWidth: 0.25,
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(SLATE_700[0], SLATE_700[1], SLATE_700[2]);
  doc.text('Line items (all sales)', margin, y);
  y += 4;

  const lineHead = buildPosDailyLineItemHeadersWithCurrency(currency);
  const rawRows = buildPosDailyLineItemDataRows(txs);
  const body =
    rawRows.length === 0
      ? [
          [
            '—',
            '—',
            'No completed POS sales for this date.',
            '',
            '',
            '',
            '',
            '',
          ],
        ]
      : rawRows.map((r) => [
          r[0],
          fmtUtcDateTime(r[1] || null),
          r[2],
          r[3],
          fmtMoney(Number(r[4]) || 0, currency),
          fmtMoney(Number(r[5]) || 0, currency),
          fmtMoney(Number(r[6]) || 0, currency),
          r[7] || '',
        ]);

  const saleEndRowFlags = rawRows.map((r, i) => {
    const next = rawRows[i + 1];
    return !next || String(next[0] ?? '') !== String(r[0] ?? '');
  });

  autoTable(doc, {
    startY: y,
    head: [lineHead],
    body,
    theme: 'striped',
    headStyles: {
      fillColor: ACCENT,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
    },
    bodyStyles: {
      fontSize: 7,
      cellPadding: { top: 1.5, right: 1.5, bottom: 1.5, left: 1.5 },
      valign: 'top',
    },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 24 },
      2: { cellWidth: 36 },
      3: { cellWidth: 6, halign: 'right' },
      4: { cellWidth: 28, halign: 'right', fontSize: 7 },
      5: { cellWidth: 28, halign: 'right', fontSize: 7 },
      6: { cellWidth: 28, halign: 'right', fontSize: 7 },
      7: { cellWidth: 14 },
    },
    margin: { left: margin, right: margin },
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.2,
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawCell: (data) => {
      if (data.section !== 'body') return;
      const ri = data.row.index;
      if (ri < 0 || ri >= saleEndRowFlags.length) return;
      if (data.column.index !== 7) return;
      if (!saleEndRowFlags[ri]) return;
      const dref = data.doc;
      const pw = dref.internal.pageSize.getWidth();
      const yLine = data.cell.y + data.cell.height;
      dref.setDrawColor(90, 90, 90);
      dref.setLineWidth(0.4);
      dref.line(margin, yLine, pw - margin, yLine);
    },
    didDrawPage: (data) => {
      if (data.pageNumber === 1) return;
      doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.rect(0, 0, pageW, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`${company} — Daily POS — ${date}`, margin, 6.5);
      doc.setTextColor(0, 0, 0);
    },
  });

  drawFooterPageNumbers(doc, margin);

  return Buffer.from(doc.output('arraybuffer'));
}
