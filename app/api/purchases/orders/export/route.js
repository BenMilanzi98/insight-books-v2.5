// app/api/purchases/orders/export/route.js
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
        where.poDate = {};
        if (startDate) where.poDate.gte = new Date(startDate);
        if (endDate) where.poDate.lte = new Date(endDate);
      }
    }

    const orders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: {
          select: {
            supplierName: true,
            supplierCode: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: { poDate: 'desc' }
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
      ['PURCHASE ORDERS EXPORT'],
      [''],
      [`Export Date: ${exportDate}`],
      [`Date Range: ${dateRange}`],
      [`Total Records: ${orders.length}`],
      ['']
    ];

    const csvHeaders = [
      'PO Number',
      'Supplier Name',
      'Supplier Code',
      'PO Date',
      'Expected Delivery Date',
      'Status',
      'Total Amount (MWK)',
      'Payment Terms',
      'Number of Items'
    ];

    const csvRows = orders.map(order => [
      order.poNumber || 'N/A',
      order.supplier?.supplierName || 'N/A',
      order.supplier?.supplierCode || 'N/A',
      formatDate(order.poDate),
      formatDate(order.expectedDeliveryDate),
      order.status || 'N/A',
      formatCurrency(order.totalAmount),
      order.paymentTerms ? `${order.paymentTerms} days` : 'N/A',
      (order.items?.length || 0).toString()
    ]);

    // Calculate totals
    const totalAmount = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const totalItems = orders.reduce((sum, order) => sum + (order.items?.length || 0), 0);

    const summaryRows = [
      [''],
      ['SUMMARY'],
      ['Total Orders:', orders.length.toString()],
      ['Total Order Value:', formatCurrency(totalAmount)],
      ['Total Items Ordered:', totalItems.toString()]
    ];

    const allRows = [...headerRows, csvHeaders, ...csvRows, ...summaryRows];
    const csvContent = allRows
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="orders-export-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (error) {
    console.error('Error exporting orders:', error);
    return NextResponse.json(
      { error: 'Failed to export orders. Please try again.' },
      { status: 500 }
    );
  }
}

