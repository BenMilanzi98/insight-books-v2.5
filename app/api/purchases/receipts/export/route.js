// app/api/purchases/receipts/export/route.js
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
        where.receiptDate = {};
        if (startDate) where.receiptDate.gte = new Date(startDate);
        if (endDate) where.receiptDate.lte = new Date(endDate);
      }
    }

    const receipts = await prisma.goodsReceipt.findMany({
      where,
      include: {
        supplier: {
          select: {
            supplierName: true,
            supplierCode: true
          }
        },
        purchaseOrder: {
          select: {
            poNumber: true
          }
        }
      },
      orderBy: { receiptDate: 'desc' }
    });

    // Helper function to format currency
    const formatCurrency = (amount) => {
      return `MWK ${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Helper function to format date
    const formatDate = (date) => {
      if (!date) return 'N/A';
      const d = new Date(date);
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
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
      ['GOODS RECEIPTS EXPORT'],
      [''],
      [`Export Date: ${exportDate}`],
      [`Date Range: ${dateRange}`],
      [`Total Records: ${receipts.length}`],
      ['']
    ];

    const csvHeaders = [
      'Receipt Number',
      'Supplier Name',
      'Supplier Code',
      'Receipt Date',
      'Purchase Order Number',
      'Status',
      'Total Amount (MWK)'
    ];

    const csvRows = receipts.map(receipt => [
      receipt.receiptNumber || 'N/A',
      receipt.supplier?.supplierName || 'N/A',
      receipt.supplier?.supplierCode || 'N/A',
      formatDate(receipt.receiptDate),
      receipt.purchaseOrder?.poNumber || 'N/A',
      receipt.status || 'N/A',
      formatCurrency(receipt.totalAmount)
    ]);

    // Calculate totals
    const totalAmount = receipts.reduce((sum, receipt) => sum + Number(receipt.totalAmount || 0), 0);
    const postedCount = receipts.filter(r => r.status === 'Posted').length;
    const draftCount = receipts.filter(r => r.status === 'Draft').length;

    const summaryRows = [
      [''],
      ['SUMMARY'],
      ['Total Receipts:', receipts.length.toString()],
      ['Posted Receipts:', postedCount.toString()],
      ['Draft Receipts:', draftCount.toString()],
      ['Total Value Received:', formatCurrency(totalAmount)]
    ];

    const allRows = [...headerRows, csvHeaders, ...csvRows, ...summaryRows];
    const csvContent = allRows
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="receipts-export-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (error) {
    console.error('Error exporting receipts:', error);
    return NextResponse.json(
      { error: 'Failed to export receipts. Please try again.' },
      { status: 500 }
    );
  }
}

