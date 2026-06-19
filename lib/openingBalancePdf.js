/**
 * Opening balances PDF export.
 */
export async function generateOpeningBalancePdfBuffer(report, meta) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const margin = 40;
  let y = margin;
  const s = report.summary;

  doc.setFontSize(16);
  doc.text('Opening Balances Report', margin, y);
  y += 22;
  doc.setFontSize(10);
  doc.text(`Business: ${meta.businessName}`, margin, y);
  y += 14;
  doc.text(
    `Starting date: ${s.startingDate ? new Date(s.startingDate).toLocaleDateString() : 'Not set'}`,
    margin,
    y,
  );
  y += 14;
  doc.text(`Status: ${s.locked ? 'LOCKED' : 'Editable'}`, margin, y);
  y += 20;

  autoTable(doc, {
    startY: y,
    head: [['Category', 'Amount (MWK)']],
    body: [
      ['Opening stock', fmt(s.stockTotal)],
      ['Payment accounts', fmt(s.paymentAccountsTotal)],
      ['Receivables', fmt(s.receivablesTotal)],
      ['Payables', fmt(s.payablesTotal)],
      ['Fixed assets', fmt(s.fixedAssetsTotal)],
      ['Opening Balance Equity', fmt(s.equityAccount.balance)],
    ],
    theme: 'grid',
    styles: { fontSize: 9 },
  });

  y = doc.lastAutoTable.finalY + 20;

  autoTable(doc, {
    startY: y,
    head: [['Ref', 'Date', 'Type', 'Amount']],
    body: (report.journalEntries || []).slice(0, 100).map((j) => [
      j.reference || '—',
      j.date ? new Date(j.date).toLocaleDateString() : '',
      j.type,
      fmt(j.amount),
    ]),
    theme: 'striped',
    styles: { fontSize: 8 },
  });

  return Buffer.from(doc.output('arraybuffer'));
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-MW', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
