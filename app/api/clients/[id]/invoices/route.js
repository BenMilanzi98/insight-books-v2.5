// app/api/clients/[id]/invoices/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// GET - Fetch invoices for a specific client
export async function GET(request, { params }) {
  try {
    const clientId = params.id;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Check if client exists and belongs to the user's tenant
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        tenantId: true
      }
    });
    
    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }
    
    if (client.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters for filtering
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit')) || null;
    
    // Build filter object for Prisma
    const where = {
      clientId,
      tenantId: user.tenantId
    };
    
    // Add status filter if provided
    if (status && status !== 'all') {
      where.status = status;
    }
    
    // Fetch the invoices
    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { issueDate: 'desc' },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        issueDate: true,
        dueDate: true,
        subtotal: true,
        taxAmount: true,
        total: true,
        createdAt: true,
        payments: {
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            paymentMethod: true
          }
        }
      },
      ...(limit ? { take: limit } : {}) // Add limit if provided
    });
    
    // Process invoices to add payment information
    const processedInvoices = invoices.map(invoice => {
      // Calculate total paid amount
      const paidAmount = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
      
      // Calculate outstanding amount
      const outstandingAmount = invoice.total - paidAmount;
      
      // Determine if fully paid
      const isFullyPaid = paidAmount >= invoice.total;
      
      // Check if overdue
      const isOverdue = !isFullyPaid && new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid';
      
      // Format dates
      const formattedIssueDate = invoice.issueDate.toISOString().split('T')[0];
      const formattedDueDate = invoice.dueDate.toISOString().split('T')[0];
      
      // Format the most recent payment date if available
      let lastPaymentDate = null;
      if (invoice.payments.length > 0) {
        const sortedPayments = [...invoice.payments].sort((a, b) => 
          new Date(b.paymentDate) - new Date(a.paymentDate)
        );
        lastPaymentDate = sortedPayments[0].paymentDate.toISOString().split('T')[0];
      }
      
      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        date: formattedIssueDate,
        dueDate: formattedDueDate,
        amount: invoice.total,
        paidAmount,
        outstandingAmount,
        isFullyPaid,
        isOverdue,
        lastPaymentDate,
        paymentCount: invoice.payments.length
      };
    });
    
    return NextResponse.json({
      invoices: processedInvoices
    });
  } catch (error) {
    console.error(`Error fetching invoices for client ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices. Please try again.' },
      { status: 500 }
    );
  }
}