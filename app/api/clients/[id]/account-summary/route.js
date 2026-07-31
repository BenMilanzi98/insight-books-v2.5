// app/api/clients/[id]/account-summary/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { getClientOutstandingBalance } from '@/lib/balanceReminderService';
import { addMoney, parseMoney, subtractMoney } from '@/lib/money';

/**
 * GET - Download client account summary (trading history)
 * Returns a comprehensive summary of all client transactions
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
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json'; // json, csv, pdf
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Verify client belongs to tenant
    const client = await prisma.client.findUnique({
      where: {
        id: clientId,
        tenantId: user.tenantId
      },
      include: {
        tenant: {
          include: {
            settings: true
          }
        }
      }
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    // Get all invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        clientId,
        tenantId: user.tenantId,
        ...(Object.keys(dateFilter).length > 0 && { issueDate: dateFilter })
      },
      include: {
        items: true,
        payments: {
          where: { status: 'Completed' },
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            paymentMethod: true,
            reference: true
          }
        }
      },
      orderBy: {
        issueDate: 'desc'
      }
    });

    // Get all sales (POS)
    const sales = await prisma.sale.findMany({
      where: {
        clientId,
        tenantId: user.tenantId,
        ...(Object.keys(dateFilter).length > 0 && { saleDate: dateFilter })
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                sku: true
              }
            }
          }
        },
        payments: {
          where: { status: 'Completed' },
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            paymentMethod: true,
            reference: true
          }
        }
      },
      orderBy: {
        saleDate: 'desc'
      }
    });

    // Quotations are not part of accounting: they are not submitted to journals or general ledger
    // and are not accounts receivable. Only invoices and sales represent actual accounting entries.

    // Calculate totals from invoice/payment and sales data (so CSV/PDF match)
    const totalInvoiced = invoices.reduce((sum, inv) => addMoney(sum, inv.total), 0);
    const totalPaid = invoices.reduce((sum, inv) => {
      const paid = inv.payments.reduce((pSum, p) => addMoney(pSum, p.amount), 0);
      return addMoney(sum, paid);
    }, 0);
    const totalOutstanding = Math.max(0, subtractMoney(totalInvoiced, totalPaid));
    const totalSales = sales.reduce((sum, sale) => addMoney(sum, sale.total), 0);
    const balanceInfo = await getClientOutstandingBalance(clientId, user.tenantId);

    // Format transactions
    const transactions = [];

    // Add invoices
    invoices.forEach(invoice => {
      const paid = invoice.payments.reduce((sum, p) => addMoney(sum, p.amount), 0);
      const balance = subtractMoney(invoice.total, paid);
      
      transactions.push({
        type: 'Invoice',
        date: invoice.issueDate,
        reference: invoice.invoiceNumber,
        description: `Invoice #${invoice.invoiceNumber}`,
        debit: parseMoney(invoice.total),
        credit: 0,
        balance: balance,
        status: invoice.status,
        dueDate: invoice.dueDate
      });

      // Add payments
      invoice.payments.forEach(payment => {
        transactions.push({
          type: 'Payment',
          date: payment.paymentDate,
          reference: payment.reference || payment.id,
          description: `Payment for Invoice #${invoice.invoiceNumber} (${payment.paymentMethod})`,
          debit: 0,
          credit: parseMoney(payment.amount),
          balance: 0,
          status: 'Completed',
          relatedInvoice: invoice.invoiceNumber
        });
      });
    });

    // Add sales
    sales.forEach(sale => {
      transactions.push({
        type: 'Sale',
        date: sale.saleDate,
        reference: sale.reference || sale.id,
        description: `POS Sale #${sale.reference || sale.id}`,
        debit: parseMoney(sale.total),
        credit: 0,
        balance: 0,
        status: sale.status
      });

      // Add payments
      sale.payments.forEach(payment => {
        transactions.push({
          type: 'Payment',
          date: payment.paymentDate,
          reference: payment.reference || payment.id,
          description: `Payment for Sale (${payment.paymentMethod})`,
          debit: 0,
          credit: parseMoney(payment.amount),
          balance: 0,
          status: 'Completed',
          relatedSale: sale.reference || sale.id
        });
      });
    });

    // Quotations are excluded: they are not accounting entries and must not appear as receivables.

    // Sort by date
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Build summary
    const summary = {
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        address: client.address
      },
      period: {
        startDate: startDate || 'All Time',
        endDate: endDate || 'All Time'
      },
      totals: {
        totalInvoiced,
        totalPaid,
        totalOutstanding,
        totalSales,
        netTotal: totalInvoiced + totalSales
      },
      outstanding: {
        totalBalance: totalOutstanding,
        invoiceCount: balanceInfo.invoiceCount,
        invoices: balanceInfo.invoices.map(inv => ({
          invoiceNumber: inv.invoiceNumber,
          issueDate: inv.issueDate,
          dueDate: inv.dueDate,
          total: inv.total,
          paid: inv.totalPaid || 0,
          balanceDue: inv.balanceDue,
          status: inv.status
        }))
      },
      transactions,
      generatedAt: new Date().toISOString()
    };

    // Return based on format
    if (format === 'csv') {
      // Generate CSV
      const csvRows = [];
      csvRows.push(['Date', 'Type', 'Reference', 'Description', 'Debit', 'Credit', 'Balance', 'Status'].join(','));
      
      transactions.forEach(tx => {
        csvRows.push([
          new Date(tx.date).toLocaleDateString(),
          tx.type,
          tx.reference,
          `"${tx.description}"`,
          tx.debit.toFixed(2),
          tx.credit.toFixed(2),
          tx.balance != null ? tx.balance.toFixed(2) : '0.00',
          tx.status
        ].join(','));
      });
      csvRows.push('');
      csvRows.push(['Summary', '', '', 'Total Invoiced', totalInvoiced.toFixed(2), '', '', ''].join(','));
      csvRows.push(['', '', '', 'Total Paid', '', totalPaid.toFixed(2), '', ''].join(','));
      csvRows.push(['', '', '', 'Outstanding', '', '', totalOutstanding.toFixed(2), ''].join(','));

      return new NextResponse(csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="client-account-summary-${client.name}-${Date.now()}.csv"`
        }
      });
    } else if (format === 'pdf') {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;
      let yPos = margin;

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Client Account Summary', pageWidth / 2, yPos, { align: 'center' });
      yPos += 8;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(client.name, pageWidth / 2, yPos, { align: 'center' });
      yPos += 6;
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated ${new Date().toLocaleString()} | Period: ${summary.period.startDate} to ${summary.period.endDate}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;
      doc.setTextColor(0, 0, 0);

      const tableData = transactions.map(tx => [
        new Date(tx.date).toLocaleDateString(),
        tx.type,
        tx.reference || '-',
        tx.description || '-',
        (tx.debit || 0).toFixed(2),
        (tx.credit || 0).toFixed(2),
        (tx.balance != null ? tx.balance : 0).toFixed(2),
        tx.status || '-'
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Date', 'Type', 'Reference', 'Description', 'Debit', 'Credit', 'Balance', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' }
        },
        margin: { left: margin, right: margin }
      });

      yPos = doc.lastAutoTable.finalY + 10;
      if (yPos > 180) {
        doc.addPage('a4', 'landscape');
        yPos = margin;
      }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Invoiced: ${totalInvoiced.toFixed(2)}  |  Total Paid: ${totalPaid.toFixed(2)}  |  Outstanding: ${totalOutstanding.toFixed(2)}`, margin, yPos);

      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="client-account-summary-${(client.name || 'client').replace(/\s+/g, '-')}-${Date.now()}.pdf"`
        }
      });
    } else if (format === 'xlsx' || format === 'excel') {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'InsightBooks';
      workbook.created = new Date();

      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.columns = [
        { header: 'Field', key: 'field', width: 28 },
        { header: 'Value', key: 'value', width: 40 },
      ];
      summarySheet.addRows([
        { field: 'Client', value: client.name },
        { field: 'Email', value: client.email || '' },
        { field: 'Phone', value: client.phone || '' },
        { field: 'Address', value: client.address || '' },
        { field: 'Total Invoiced', value: totalInvoiced },
        { field: 'Total Paid', value: totalPaid },
        { field: 'Outstanding', value: totalOutstanding },
        { field: 'Total Sales (POS)', value: totalSales },
        { field: 'Generated At', value: summary.generatedAt },
      ]);

      const txSheet = workbook.addWorksheet('Transactions');
      txSheet.columns = [
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Type', key: 'type', width: 12 },
        { header: 'Reference', key: 'reference', width: 18 },
        { header: 'Description', key: 'description', width: 44 },
        { header: 'Debit', key: 'debit', width: 14 },
        { header: 'Credit', key: 'credit', width: 14 },
        { header: 'Balance', key: 'balance', width: 14 },
        { header: 'Status', key: 'status', width: 12 },
      ];
      transactions.forEach((tx) => {
        txSheet.addRow({
          date: tx.date ? new Date(tx.date).toLocaleDateString() : '',
          type: tx.type,
          reference: tx.reference || '',
          description: tx.description || '',
          debit: Number(tx.debit || 0),
          credit: Number(tx.credit || 0),
          balance: Number(tx.balance != null ? tx.balance : 0),
          status: tx.status || '',
        });
      });

      const invSheet = workbook.addWorksheet('Outstanding Invoices');
      invSheet.columns = [
        { header: 'Invoice', key: 'invoiceNumber', width: 16 },
        { header: 'Issue Date', key: 'issueDate', width: 14 },
        { header: 'Due Date', key: 'dueDate', width: 14 },
        { header: 'Total', key: 'total', width: 14 },
        { header: 'Paid', key: 'paid', width: 14 },
        { header: 'Balance Due', key: 'balanceDue', width: 14 },
        { header: 'Status', key: 'status', width: 12 },
      ];
      (summary.outstanding?.invoices || []).forEach((inv) => {
        invSheet.addRow({
          invoiceNumber: inv.invoiceNumber,
          issueDate: inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : '',
          dueDate: inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '',
          total: Number(inv.total || 0),
          paid: Number(inv.paid || 0),
          balanceDue: Number(inv.balanceDue || 0),
          status: inv.status || '',
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const safeName = (client.name || 'client').replace(/[^\w\-]+/g, '-');
      return new NextResponse(Buffer.from(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="client-account-summary-${safeName}-${Date.now()}.xlsx"`,
        },
      });
    } else if (format === 'json') {
      return NextResponse.json(summary);
    } else {
      return NextResponse.json(summary);
    }
  } catch (error) {
    console.error('Error generating client account summary:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate account summary' },
      { status: 500 }
    );
  }
}
