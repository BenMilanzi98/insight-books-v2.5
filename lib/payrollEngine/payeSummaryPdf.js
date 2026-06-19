/**
 * PAYE Summary PDF export (jspdf-autotable).
 */
export async function generatePayeSummaryPdfBuffer(report, meta) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const margin = 40;
  let y = margin;

  doc.setFontSize(16);
  doc.text('PAYE Summary Report', margin, y);
  y += 22;
  doc.setFontSize(10);
  doc.text(`Business: ${meta.businessName}`, margin, y);
  y += 14;
  doc.text(`Period: ${meta.periodLabel}`, margin, y);
  y += 14;
  doc.text(`Generated: ${meta.generatedAt.toLocaleString()} by ${meta.generatedBy}`, margin, y);
  y += 20;

  doc.setFontSize(11);
  doc.text('Summary', margin, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value (MWK)']],
    body: [
      ['Employees', String(report.summary.employeeCount)],
      ['Total gross pay', formatNum(report.summary.totalGrossPay)],
      ['Total taxable income', formatNum(report.summary.totalTaxableIncome)],
      ['Total PAYE deducted', formatNum(report.summary.totalPayeDeducted)],
      ['PAYE remitted (MRA)', formatNum(report.summary.totalPayeRemitted ?? 0)],
      ['PAYE outstanding', formatNum(report.summary.totalPayeOutstanding ?? 0)],
      ['Total net pay', formatNum(report.summary.totalNetPay)],
    ],
    theme: 'grid',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [79, 70, 229] },
  });

  y = doc.lastAutoTable.finalY + 24;

  autoTable(doc, {
    startY: y,
    head: [[
      'Emp No',
      'Name',
      'Dept',
      'Gross',
      'Taxable Inc.',
      'PAYE',
      'NPS Emp',
      'Net Pay',
      'Period',
      'Status',
    ]],
    body: report.rows.slice(0, 500).map((r) => [
      r.employeeNumber,
      r.employeeName,
      r.department,
      formatNum(r.grossPay),
      formatNum(r.taxableIncome),
      formatNum(r.payeDeducted),
      formatNum(r.pensionEmployee),
      formatNum(r.netPay),
      r.payrollPeriod?.label?.slice(0, 18) || '',
      r.payrollStatus,
    ]),
    theme: 'striped',
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: { fillColor: [79, 70, 229] },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() - margin,
      doc.internal.pageSize.getHeight() - 20,
      { align: 'right' },
    );
  }

  return Buffer.from(doc.output('arraybuffer'));
}

function formatNum(n) {
  return Number(n || 0).toLocaleString('en-MW', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
