// app/api/sales/export/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { createObjectCsvStringifier } from '@/lib/csv-writer';
import { getPaymentMethodName } from '@/lib/paymentMethods';
import { exportToNumber, exportSumField } from '@/lib/exportNumberUtils';

// GET - Export sales data in CSV format
export async function GET(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const status = searchParams.get('status');
    const clientId = searchParams.get('clientId');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const branchId = searchParams.get('branchId');
    const format = searchParams.get('format') || 'csv'; // Default to CSV
    
    // Build filter object for Prisma
    const where = {
      tenantId: user.tenantId, // Filter by tenant ID for multi-tenancy
    };

    if (branchId) {
      where.branchId = branchId;
    }
    
    // Add status filter if provided
    if (status && status !== 'all') {
      where.status = status;
    }
    
    // Add client filter if provided
    if (clientId && clientId !== 'all') {
      where.clientId = clientId;
    }
    
    // Add date range filter if provided
    if (dateFrom || dateTo) {
      where.saleDate = {};
      if (dateFrom) {
        where.saleDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.saleDate.lte = new Date(dateTo);
      }
    }
    
    // Add search filter if provided
    if (search) {
      where.OR = [
        { saleNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }
    
    // Fetch sales with related data
    const sales = await prisma.sale.findMany({
      where,
      orderBy: { saleDate: 'desc' },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          }
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      }
    });
    
    // For CSV format
    if (format === 'csv') {
      return generateCsvResponse(sales);
    }
    
    // For other formats (could implement PDF, Excel, etc.)
    return NextResponse.json(
      { error: 'Unsupported export format' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error exporting sales:', error);
    return NextResponse.json(
      { error: 'Failed to export sales. Please try again.' },
      { status: 500 }
    );
  }
}

// Generate CSV response
async function generateCsvResponse(sales) {
  // Define CSV header
  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: 'saleNumber', title: 'Sale ID' },
      { id: 'date', title: 'Date' },
      { id: 'client', title: 'Customer' },
      { id: 'clientEmail', title: 'Customer Email' },
      { id: 'clientPhone', title: 'Customer Phone' },
      { id: 'productNames', title: 'Products' },
      { id: 'items', title: 'Total Items' },
      { id: 'subtotal', title: 'Subtotal' },
      { id: 'tax', title: 'Tax Amount' },
      { id: 'total', title: 'Total' },
      { id: 'paymentMethod', title: 'Payment Method' },
      { id: 'status', title: 'Status' },
      { id: 'createdBy', title: 'Created By' },
      { id: 'notes', title: 'Notes' }
    ]
  });
  
  // Transform sales data for CSV
  const records = sales.map(sale => {
    const totalItems = exportSumField(sale.items, 'quantity');
    const productNames = sale.items.map(item => {
      const label = item.product?.name || item.description || 'Item';
      const qty = exportToNumber(item.quantity);
      return `${label} (x${qty})`;
    }).join('; ');

    const subtotal = exportToNumber(sale.subtotal);
    const total = exportToNumber(sale.total);
    const lineTaxSum = exportSumField(sale.items, 'taxAmount');
    const totalTax = exportToNumber(sale.totalTaxAmount);
    const legacyTax = exportToNumber(sale.taxAmount);
    let taxForExport = totalTax;
    if (taxForExport === 0) taxForExport = legacyTax;
    if (taxForExport === 0) taxForExport = lineTaxSum;

    return {
      saleNumber: sale.saleNumber,
      date: sale.saleDate.toISOString().split('T')[0],
      client: sale.client ? sale.client.name : 'Walk-in Customer',
      clientEmail: sale.client ? sale.client.email : '',
      clientPhone: sale.client ? (sale.client.phone || '') : '',
      productNames,
      items: totalItems,
      subtotal: subtotal.toFixed(2),
      tax: taxForExport.toFixed(2),
      total: total.toFixed(2),
      paymentMethod: getPaymentMethodName(sale.paymentMethod),
      status: formatStatus(sale.status),
      createdBy: sale.createdBy?.name || '',
      notes: sale.notes || ''
    };
  });
  
  // Generate CSV content
  const csvContent = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  
  // Create filename with current date
  const date = new Date().toISOString().split('T')[0];
  const filename = `sales_export_${date}.csv`;
  
  // Return CSV file
  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}

// Format payment method for display
// function formatPaymentMethod(method) {
//   const methodMap = {
//     'cash': 'Cash',
//     'card': 'Card',
//     'mobile_money': 'Mobile Money',
//     'bank_transfer': 'Bank Transfer',
//     'check': 'Check'
//   };
  
//   return methodMap[method] || method;
// }

// Format status for display
function formatStatus(status) {
  const statusMap = {
    'completed': 'Completed',
    'void': 'Void',
    'refunded': 'Refunded',
    'draft': 'Draft'
  };
  
  return statusMap[status] || status;
}