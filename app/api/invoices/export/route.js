// app/api/invoices/export/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { createObjectCsvStringifier } from '@/lib/csv-writer';

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
    const client = searchParams.get('client');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const format = searchParams.get('format') || 'csv'; // Default to CSV
    
    // Build filter object for Prisma
    const where = {
      tenantId: user.tenantId, // Filter by tenant ID for multi-tenancy
      isDeleted: false,
      isReversal: false,
    };
    
    // Add status filter if provided
    if (status) {
      where.status = status;
    }
    
    // Add client filter if provided
    if (client) {
      where.clientId = client;
    }
    
    // Add date range filter for issue date if provided
    if (dateFrom || dateTo) {
      where.issueDate = {};
      if (dateFrom) {
        where.issueDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.issueDate.lte = new Date(dateTo);
      }
    }
    
    // Add search filter if provided
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } },
        { client: { email: { contains: search, mode: 'insensitive' } } }
      ];
    }
    
    // Fetch invoices with client information
    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { issueDate: 'desc' },
      include: {
        client: true,
        items: true
      }
    });
    
    // For CSV format
    if (format === 'csv') {
      return generateCsvResponse(invoices);
    }
    
    // For other formats (could implement PDF, Excel, etc.)
    return NextResponse.json(
      { error: 'Unsupported export format' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error exporting invoices:', error);
    return NextResponse.json(
      { error: 'Failed to export invoices. Please try again.' },
      { status: 500 }
    );
  }
}

// Helper function to generate CSV response
async function generateCsvResponse(invoices) {
  // Define CSV header
  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: 'invoiceNumber', title: 'Invoice Number' },
      { id: 'date', title: 'Issue Date' },
      { id: 'dueDate', title: 'Due Date' },
      { id: 'client', title: 'Client' },
      { id: 'email', title: 'Client Email' },
      { id: 'subtotal', title: 'Subtotal' },
      { id: 'tax', title: 'Tax' },
      { id: 'total', title: 'Total' },
      { id: 'status', title: 'Status' },
      { id: 'createdAt', title: 'Created At' }
    ]
  });
  
  // Transform invoices data for CSV
  const records = invoices.map(invoice => ({
    invoiceNumber: invoice.invoiceNumber,
    date: invoice.issueDate.toISOString().split('T')[0],
    dueDate: invoice.dueDate.toISOString().split('T')[0],
    client: invoice.client.name,
    email: invoice.client.email,
    subtotal: invoice.subtotal.toFixed(2),
    tax: invoice.taxAmount.toFixed(2),
    total: invoice.total.toFixed(2),
    status: invoice.status,
    createdAt: invoice.createdAt.toISOString().split('T')[0]
  }));
  
  // Generate CSV content
  const csvContent = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  
  // Create filename with current date
  const date = new Date().toISOString().split('T')[0];
  const filename = `invoices_export_${date}.csv`;
  
  // Return CSV file
  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}