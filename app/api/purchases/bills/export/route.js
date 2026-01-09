// app/api/purchases/bills/export/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const id = searchParams.get('id');

    const where = { tenantId: user.tenantId };

    if (id) {
      where.id = id;
    } else {
      if (startDate || endDate) {
        where.billDate = {};
        if (startDate) where.billDate.gte = new Date(startDate);
        if (endDate) where.billDate.lte = new Date(endDate);
      }
    }

    const bills = await prisma.supplierBill.findMany({
      where,
      include: {
        supplier: {
          select: {
            supplierName: true,
            supplierCode: true
          }
        }
      },
      orderBy: { billDate: 'desc' }
    });

    // Helper function to format currency
    const formatCurrency = (amount) => {
      return `MWK ${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Helper function to format date (DD-MM-YYYY)
    const formatDate = (date) => {
      if (!date) return 'N/A';
      try {
        const dateObj = new Date(date);
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        return `${day}-${month}-${year}`;
      } catch (error) {
        return 'N/A';
      }
    };

    // Build CSV content with header information
    const exportDate = formatDate(new Date());
    const dateRange = startDate && endDate 
      ? `${formatDate(startDate)} to ${formatDate(endDate)}`
      : startDate 
        ? `From ${formatDate(startDate)}`
        : endDate
          ? `Until ${formatDate(endDate)}`
          : 'All Time';

    const headerRows = [
      ['SUPPLIER BILLS EXPORT'],
      [''],
      [`Export Date: ${exportDate}`],
      [`Date Range: ${dateRange}`],
      [`Total Records: ${bills.length}`],
      ['']
    ];

    const csvHeaders = [
      'Bill Number',
      'Supplier Name',
      'Supplier Code',
      'Bill Date',
      'Due Date',
      'Total Amount (MWK)',
      'Amount Paid (MWK)',
      'Outstanding Balance (MWK)',
      'Status',
      'Supplier Invoice Number'
    ];

    const csvRows = bills.map(bill => {
      const totalAmount = Number(bill.totalAmount || 0);
      const amountPaid = Number(bill.amountPaid || 0);
      const balance = totalAmount - amountPaid;
      
      return [
        bill.billNumber || 'N/A',
        bill.supplier?.supplierName || 'N/A',
        bill.supplier?.supplierCode || 'N/A',
        formatDate(bill.billDate),
        formatDate(bill.dueDate),
        formatCurrency(totalAmount),
        formatCurrency(amountPaid),
        formatCurrency(balance),
        bill.status || 'N/A',
        bill.supplierInvoiceNumber || 'N/A'
      ];
    });

    // Calculate totals
    const totalAmount = bills.reduce((sum, bill) => sum + Number(bill.totalAmount || 0), 0);
    const totalPaid = bills.reduce((sum, bill) => sum + Number(bill.amountPaid || 0), 0);
    const totalBalance = totalAmount - totalPaid;

    const summaryRows = [
      [''],
      ['SUMMARY'],
      ['Total Bills Amount:', formatCurrency(totalAmount)],
      ['Total Amount Paid:', formatCurrency(totalPaid)],
      ['Total Outstanding Balance:', formatCurrency(totalBalance)]
    ];

    const allRows = [...headerRows, csvHeaders, ...csvRows, ...summaryRows];
    const csvContent = allRows
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="bills-export-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (error) {
    console.error('Error exporting bills:', error);
    return NextResponse.json(
      { error: 'Failed to export bills. Please try again.' },
      { status: 500 }
    );
  }
}

