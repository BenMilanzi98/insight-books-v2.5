// app/api/payments/export/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// GET - Export payments to CSV
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');
    const paymentMethod = searchParams.get('paymentMethod');

    // Build filter conditions
    const where = {
      tenantId: user.tenantId
    };

    // Add date filters
    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) where.paymentDate.gte = new Date(startDate);
      if (endDate) where.paymentDate.lte = new Date(endDate);
    }

    // Add status filter
    if (status && status !== 'All') {
      where.status = status;
    }

    // Add payment method filter
    if (paymentMethod && paymentMethod !== 'All') {
      where.paymentMethod = paymentMethod;
    }

    // Fetch payments with related data
    const payments = await prisma.payment.findMany({
      where,
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            client: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        paymentDate: 'desc'
      }
    });

    if (format === 'csv') {
      // Generate CSV content
      const csvHeaders = [
        'Payment Date',
        'Invoice Number',
        'Client Name',
        'Amount',
        'Payment Method',
        'Reference',
        'Status',
        'Notes'
      ];

      const csvRows = payments.map(payment => [
        payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : '',
        payment.invoice?.invoiceNumber || '',
        payment.invoice?.client?.name || '',
        payment.amount.toString(),
        payment.paymentMethod || '',
        payment.reference || '',
        payment.status || '',
        payment.notes || ''
      ]);

      // Combine headers and rows
      const allRows = [csvHeaders, ...csvRows];
      
      // Convert to CSV format
      const csvContent = allRows
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      // Return CSV response
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="payments-export-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    // For other formats (future expansion)
    return NextResponse.json(
      { error: 'Unsupported export format' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error exporting payments:', error);
    return NextResponse.json(
      { error: 'Failed to export payments. Please try again.' },
      { status: 500 }
    );
  }
}
