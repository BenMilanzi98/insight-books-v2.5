// app/api/receivables/export/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { addMoney, parseMoney, subtractMoney } from '@/lib/money';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const statusFilter = searchParams.get('statusFilter'); // "All", "Pending", "Overdue", "Not Due"

    const now = new Date();

    // Build filter for outstanding invoices only
    const where = {
      tenantId: user.tenantId,
      // Exclude voided and refunded invoices
      voidedAt: null,
      refundedAt: null,
      // Include invoices with status Pending or Partial, or any invoice with remaining balance > 0
      OR: [
        { status: { in: ['Pending', 'Partial', 'pending', 'partial'] } },
        { remainingBalance: { gt: 0 } }
      ]
    };

    // Add search filter if provided
    if (search) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { invoiceNumber: { contains: search, mode: 'insensitive' } },
          { client: { name: { contains: search, mode: 'insensitive' } } },
          { client: { email: { contains: search, mode: 'insensitive' } } }
        ]
      });
    }

    // Fetch outstanding invoices
    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        payments: {
          where: {
            status: 'Completed'
          },
          select: {
            amount: true
          }
        }
      },
      orderBy: {
        dueDate: 'asc'
      }
    });

    // Calculate actual remaining balances and filter by status
    const outstandingInvoices = invoices
      .map(invoice => {
        // Calculate actual remaining balance from payments
        const actualTotalPaid = invoice.payments?.reduce((sum, p) => addMoney(sum, p.amount), 0) || 0;
        const actualRemaining = Math.max(0, subtractMoney(invoice.total, actualTotalPaid));
        const amountOwed = actualRemaining > 0 ? actualRemaining : parseMoney(invoice.remainingBalance);

        if (amountOwed <= 0) {
          return null; // Skip fully paid invoices
        }

        const dueDate = new Date(invoice.dueDate);
        const daysDiff = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));

        // Determine status
        let invoiceStatus = 'Pending';
        if (daysDiff < 0) {
          invoiceStatus = 'Not Due';
        } else if (daysDiff > 0) {
          invoiceStatus = 'Overdue';
        } else if (invoice.status === 'Partial') {
          invoiceStatus = 'Partial';
        }

        return {
          ...invoice,
          amountOwed,
          actualTotalPaid,
          invoiceStatus,
          daysPastDue: daysDiff > 0 ? daysDiff : 0
        };
      })
      .filter(inv => inv !== null);

    // Apply status filter
    let filteredInvoices = outstandingInvoices;
    if (statusFilter && statusFilter !== 'All') {
      if (statusFilter === 'Pending') {
        filteredInvoices = outstandingInvoices.filter(inv => inv.invoiceStatus === 'Pending' || inv.status === 'Pending');
      } else if (statusFilter === 'Overdue') {
        filteredInvoices = outstandingInvoices.filter(inv => inv.invoiceStatus === 'Overdue');
      } else if (statusFilter === 'Not Due') {
        filteredInvoices = outstandingInvoices.filter(inv => inv.invoiceStatus === 'Not Due');
      }
    }

    // Helper function to format currency
    const formatCurrency = (amount) => {
      return `MWK ${parseMoney(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Helper function to format date (DD-MM-YYYY)
    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      try {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
      } catch (error) {
        return 'N/A';
      }
    };

    // Build CSV content with header information
    const exportDate = formatDate(new Date());
    const dateRange = 'All Outstanding Invoices';
    const statusInfo = statusFilter && statusFilter !== 'All' ? ` (${statusFilter})` : '';

    const headerRows = [
      ['ACCOUNTS RECEIVABLE EXPORT'],
      [''],
      [`Export Date: ${exportDate}`],
      [`Filter: ${dateRange}${statusInfo}`],
      [`Total Outstanding Invoices: ${filteredInvoices.length}`],
      ['']
    ];

    const csvHeaders = [
      'Invoice Number',
      'Customer Name',
      'Customer Email',
      'Issue Date',
      'Due Date',
      'Total Amount (MWK)',
      'Amount Paid (MWK)',
      'Outstanding Amount (MWK)',
      'Status',
      'Days Past Due'
    ];

    const csvRows = filteredInvoices.map(invoice => [
      invoice.invoiceNumber || 'N/A',
      invoice.client?.name || 'N/A',
      invoice.client?.email || 'N/A',
      formatDate(invoice.issueDate),
      formatDate(invoice.dueDate),
      formatCurrency(invoice.total),
      formatCurrency(invoice.actualTotalPaid),
      formatCurrency(invoice.amountOwed),
      invoice.invoiceStatus || 'N/A',
      invoice.daysPastDue > 0 ? invoice.daysPastDue.toString() : '0'
    ]);

    // Calculate totals
    const totalOutstanding = filteredInvoices.reduce((sum, inv) => addMoney(sum, inv.amountOwed), 0);
    const totalInvoices = filteredInvoices.reduce((sum, inv) => addMoney(sum, inv.total), 0);
    const totalPaid = filteredInvoices.reduce((sum, inv) => addMoney(sum, inv.actualTotalPaid), 0);
    const overdueCount = filteredInvoices.filter(inv => inv.invoiceStatus === 'Overdue').length;
    const notDueCount = filteredInvoices.filter(inv => inv.invoiceStatus === 'Not Due').length;
    const pendingCount = filteredInvoices.filter(inv => inv.invoiceStatus === 'Pending').length;

    const summaryRows = [
      [''],
      ['SUMMARY'],
      ['Total Outstanding Invoices:', filteredInvoices.length.toString()],
      ['Pending:', pendingCount.toString()],
      ['Overdue:', overdueCount.toString()],
      ['Not Due:', notDueCount.toString()],
      ['Total Invoice Amount:', formatCurrency(totalInvoices)],
      ['Total Amount Paid:', formatCurrency(totalPaid)],
      ['Total Outstanding Amount:', formatCurrency(totalOutstanding)]
    ];

    const allRows = [...headerRows, csvHeaders, ...csvRows, ...summaryRows];
    const csvContent = allRows
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    // Create filename with current date
    const date = new Date().toISOString().split('T')[0];
    const filename = `accounts_receivable_export_${date}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="accounts_receivable_export_${date}.csv"`
      }
    });
  } catch (error) {
    console.error('Error exporting receivables:', error);
    return NextResponse.json(
      { error: 'Failed to export receivables. Please try again.' },
      { status: 500 }
    );
  }
}

