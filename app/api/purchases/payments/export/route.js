// app/api/purchases/payments/export/route.js
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
        where.paymentDate = {};
        if (startDate) where.paymentDate.gte = new Date(startDate);
        if (endDate) where.paymentDate.lte = new Date(endDate);
      }
    }

    const payments = await prisma.supplierPayment.findMany({
      where,
      include: {
        supplier: {
          select: {
            supplierName: true,
            supplierCode: true
          }
        },
        allocations: {
          include: {
            bill: {
              select: {
                billNumber: true
              }
            }
          }
        }
      },
      orderBy: { paymentDate: 'desc' }
    });

    // Helper function to format currency
    const formatCurrency = (amount, currency = 'MWK') => {
      return `${currency} ${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
      ['SUPPLIER PAYMENTS EXPORT'],
      [''],
      [`Export Date: ${exportDate}`],
      [`Date Range: ${dateRange}`],
      [`Total Records: ${payments.length}`],
      ['']
    ];

    const csvHeaders = [
      'Payment Number',
      'Supplier Name',
      'Supplier Code',
      'Payment Date',
      'Payment Method',
      'Amount Paid (MWK)',
      'Reference Number',
      'Number of Bills Paid',
      'Currency'
    ];

    const csvRows = payments.map(payment => {
      const currency = payment.currency || 'MWK';
      return [
        payment.paymentNumber || 'N/A',
        payment.supplier?.supplierName || 'N/A',
        payment.supplier?.supplierCode || 'N/A',
        formatDate(payment.paymentDate),
        payment.paymentMethod || 'N/A',
        formatCurrency(payment.totalAmount, currency),
        payment.referenceNumber || 'N/A',
        (payment.allocations?.length || 0).toString(),
        currency
      ];
    });

    // Calculate totals by currency
    const totalsByCurrency = {};
    payments.forEach(payment => {
      const currency = payment.currency || 'MWK';
      if (!totalsByCurrency[currency]) {
        totalsByCurrency[currency] = 0;
      }
      totalsByCurrency[currency] += Number(payment.totalAmount || 0);
    });

    const totalBillsPaid = payments.reduce((sum, payment) => sum + (payment.allocations?.length || 0), 0);

    const summaryRows = [
      [''],
      ['SUMMARY'],
      ['Total Payments:', payments.length.toString()],
      ['Total Bills Paid:', totalBillsPaid.toString()],
      ...Object.entries(totalsByCurrency).map(([currency, amount]) => [
        `Total Amount Paid (${currency}):`,
        formatCurrency(amount, currency)
      ])
    ];

    const allRows = [...headerRows, csvHeaders, ...csvRows, ...summaryRows];
    const csvContent = allRows
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="payments-export-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (error) {
    console.error('Error exporting payments:', error);
    return NextResponse.json(
      { error: 'Failed to export payments. Please try again.' },
      { status: 500 }
    );
  }
}

