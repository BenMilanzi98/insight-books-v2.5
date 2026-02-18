// app/api/clients/[id]/balance-reminder-pdf/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { getBalanceReminderContent } from '@/lib/balanceReminderService';

function formatCurrency(amount, currencyCode = 'USD') {
  return amount.toLocaleString('en-US', { style: 'currency', currency: currencyCode });
}

/**
 * GET - Download balance reminder as PDF (for manual sending)
 * Uses accurate balance from getBalanceReminderContent; well-designed layout.
 */
export async function GET(request, context) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: clientId } = await context.params;
    const content = await getBalanceReminderContent(clientId, user.tenantId);

    if (!content) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let y = margin;

    // ----- Header -----
    doc.setFillColor(55, 65, 81); // gray-700
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(content.companyName, margin, 12);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Balance Reminder', margin, 20);
    doc.setFontSize(9);
    doc.text(`Generated ${new Date().toLocaleDateString()}`, pageWidth - margin, 20, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    y = 36;

    // ----- Client & subject -----
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('To:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(content.clientName, margin + 12, y);
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Re:', margin, y);
    doc.setFont('helvetica', 'normal');
    const subjectLines = doc.splitTextToSize(content.subject, maxWidth - 12);
    doc.text(subjectLines, margin + 12, y);
    y += subjectLines.length * 5 + 10;

    const hasBalance = content.totalBalance > 0;

    if (hasBalance) {
      // ----- Summary box -----
      const boxY = y;
      doc.setDrawColor(209, 213, 219);
      doc.setLineWidth(0.5);
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(margin, boxY, maxWidth, 28, 2, 2, 'FD');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 41, 55);
      doc.text('Outstanding summary', margin + 4, boxY + 8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(75, 85, 99);
      const totalLabel = 'Total outstanding:';
      doc.text(totalLabel, margin + 4, boxY + 16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(formatCurrency(content.totalBalance, content.currencyCode), margin + 4, boxY + 22);
      doc.setFont('helvetica', 'normal');
      doc.text(`Invoices: ${content.invoiceCount}`, margin + 70, boxY + 16);
      doc.text(`Oldest due: ${content.oldestInvoiceDate}`, margin + 70, boxY + 22);
      y = boxY + 28 + 12;

      // ----- Outstanding invoices table -----
      if (content.invoices && content.invoices.length > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Outstanding invoices', margin, y);
        y += 6;
        const tableData = content.invoices.map(inv => [
          inv.invoiceNumber,
          new Date(inv.dueDate).toLocaleDateString(),
          formatCurrency(inv.balanceDue, content.currencyCode)
        ]);
        autoTable(doc, {
          startY: y,
          head: [['Invoice', 'Due date', 'Amount due']],
          body: tableData,
          theme: 'plain',
          headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
          bodyStyles: { fontSize: 9 },
          columnStyles: {
            0: { cellWidth: 45 },
            1: { cellWidth: 40 },
            2: { cellWidth: 45, halign: 'right' }
          },
          margin: { left: margin, right: margin },
          tableLineColor: [229, 231, 235],
          tableLineWidth: 0.3
        });
        y = doc.lastAutoTable.finalY + 10;
      }
    } else {
      // No balance: small info line
      doc.setFillColor(240, 253, 244); // green-50
      doc.roundedRect(margin, y, maxWidth, 14, 2, 2, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(22, 101, 52);
      doc.text('No outstanding balance', margin + 6, y + 9);
      doc.setTextColor(0, 0, 0);
      y += 22;
    }

    // ----- Message body -----
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const bodyLines = doc.splitTextToSize(content.body, maxWidth);
    for (let i = 0; i < bodyLines.length; i++) {
      if (y > pageHeight - 35) {
        doc.addPage();
        y = margin;
      }
      doc.text(bodyLines[i], margin, y);
      y += 5.5;
    }
    y += 8;

    // ----- Footer -----
    if (y > pageHeight - 25) {
      doc.addPage();
      y = margin;
    }
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, pageHeight - 22, pageWidth - margin, pageHeight - 22);
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(content.companyName, margin, pageHeight - 14);
    doc.text('Thank you for your business.', pageWidth / 2, pageHeight - 14, { align: 'center' });
    doc.text(`Balance reminder · ${new Date().toLocaleDateString()}`, pageWidth - margin, pageHeight - 14, { align: 'right' });

    const filename = `balance-reminder-${(content.clientName || 'client').replace(/\s+/g, '-')}-${Date.now()}.pdf`;
    const buf = doc.output('arraybuffer');

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating balance reminder PDF:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
