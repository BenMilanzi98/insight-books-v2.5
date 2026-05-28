// app/api/clients/export/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { createObjectCsvStringifier } from '@/lib/csv-writer';
import { addMoney, subtractMoney } from '@/lib/money';

// GET - Export clients data in CSV format
export async function GET(request) {
  try {
    // Check for standard access
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

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
    const search = searchParams.get('search');
    const format = searchParams.get('format') || 'csv'; // Default to CSV
    
    // Build filter object for Prisma
    const where = {
      tenantId: user.tenantId, // Filter by tenant ID for multi-tenancy
    };
    
    // Add search filter if provided
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Fetch clients with their invoices for financial calculations
    const clients = await prisma.client.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        invoices: {
          select: {
            total: true,
            status: true,
            payments: {
              select: {
                amount: true
              }
            }
          }
        },
        sales: {
          select: {
            total: true,
            status: true
          }
        }
      }
    });
    
    // Calculate financial metrics for each client
    const clientsWithMetrics = clients.map(client => {
      // Total billed amount (invoices + sales)
      const totalBilledFromInvoices = client.invoices.reduce((sum, invoice) => addMoney(sum, invoice.total), 0);
      const totalBilledFromSales = client.sales.reduce((sum, sale) => addMoney(sum, sale.total), 0);
      const totalBilled = addMoney(totalBilledFromInvoices, totalBilledFromSales);
      
      // Total payments received (only from invoices)
      const totalPaid = client.invoices.reduce((sum, invoice) => {
        return addMoney(sum, invoice.payments.reduce((paymentSum, payment) => addMoney(paymentSum, payment.amount), 0));
      }, 0);
      
      // Outstanding amount (only from invoices, as sales are typically paid immediately)
      const outstandingAmount = subtractMoney(totalBilledFromInvoices, totalPaid);
      
      // Determine client status based on activity (invoices OR sales)
      const hasActiveInvoices = client.invoices.some(invoice => 
        invoice.status !== 'cancelled' && invoice.status !== 'draft'
      );
      
      const hasActiveSales = client.sales.some(sale => 
        sale.status !== 'cancelled' && sale.status !== 'void'
      );
      
      const clientStatus = (hasActiveInvoices || hasActiveSales) ? 'Active' : 'Inactive';
      
      return {
        ...client,
        totalBilled,
        outstandingAmount,
        status: clientStatus,
        invoices: undefined // Remove the full invoices array
      };
    });
    
    // For CSV format
    if (format === 'csv') {
      return generateCsvResponse(clientsWithMetrics);
    }
    
    // For other formats (could implement PDF, Excel, etc.)
    return NextResponse.json(
      { error: 'Unsupported export format' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error exporting clients:', error);
    return NextResponse.json(
      { error: 'Failed to export clients. Please try again.' },
      { status: 500 }
    );
  }
}

// Generate CSV response
async function generateCsvResponse(clients) {
  // Define CSV header
  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: 'id', title: 'ID' },
      { id: 'name', title: 'Client Name' },
      { id: 'contactPerson', title: 'Contact Person' },
      { id: 'email', title: 'Email' },
      { id: 'phone', title: 'Phone' },
      { id: 'address', title: 'Address' },
      { id: 'status', title: 'Status' },
      { id: 'totalBilled', title: 'Total Billed (MWK)' },
      { id: 'outstandingAmount', title: 'Outstanding Amount (MWK)' },
      { id: 'createdAt', title: 'Created Date' }
    ]
  });
  
  // Transform clients data for CSV
  const records = clients.map(client => ({
    id: client.id,
    name: client.name,
    contactPerson: client.contactPerson || '',
    email: client.email,
    phone: client.phone || '',
    address: client.address || '',
    status: client.status,
    totalBilled: client.totalBilled.toFixed(2),
    outstandingAmount: client.outstandingAmount.toFixed(2),
    createdAt: client.createdAt.toISOString().split('T')[0]
  }));
  
  // Generate CSV content
  const csvContent = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  
  // Create filename with current date
  const date = new Date().toISOString().split('T')[0];
  const filename = `clients_export_${date}.csv`;
  
  // Return CSV file
  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}