// app/api/clients/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

// GET - Fetch clients with optional filtering, sorting, and pagination
export async function GET(request) {
  try {
    // Check for standard access (trial or paid subscription)
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
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const search = searchParams.get('search');
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Build filter object for Prisma
    const where = {
      tenantId: user.tenantId, // Filter by tenant ID for multi-tenancy
    };
    
    // Add search filter if provided
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Get total count for pagination
    const totalCount = await prisma.client.count({ where });
    
    // Build sort object for Prisma
    const orderBy = { [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' };
    
    // Fetch clients
    const clients = await prisma.client.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        contactPerson: true,
        email: true,
        additionalEmails: true,
        phone: true,
        address: true,
        createdAt: true,
        updatedAt: true,
        // Get aggregate data for invoices
        invoices: {
          select: {
            id: true,
            total: true,
            status: true,
            issueDate: true,
            dueDate: true,
            payments: {
              select: {
                amount: true
              }
            }
          }
        },
        // Get aggregate data for sales (POS transactions)
        sales: {
          select: {
            id: true,
            total: true,
            status: true,
            saleDate: true
          }
        }
      }
    });
    
    // Calculate financial metrics for each client
    const clientsWithMetrics = clients.map(client => {
      // Total billed amount (invoices + sales)
      const totalBilledFromInvoices = client.invoices.reduce((sum, invoice) => sum + invoice.total, 0);
      const totalBilledFromSales = client.sales.reduce((sum, sale) => sum + sale.total, 0);
      const totalBilled = totalBilledFromInvoices + totalBilledFromSales;
      
      // Total payments received (only from invoices for now)
      const totalPaid = client.invoices.reduce((sum, invoice) => {
        return sum + invoice.payments.reduce((paymentSum, payment) => paymentSum + payment.amount, 0);
      }, 0);
      
      // Outstanding amount (only from invoices, as sales are typically paid immediately)
      const outstandingAmount = totalBilledFromInvoices - totalPaid;
      
      // Determine client status based on activity (invoices OR sales)
      const hasActiveInvoices = client.invoices.some(invoice => 
        invoice.status !== 'cancelled' && invoice.status !== 'draft'
      );
      
      const hasActiveSales = client.sales.some(sale => 
        sale.status !== 'cancelled' && sale.status !== 'void'
      );
      
      const clientStatus = (hasActiveInvoices || hasActiveSales) ? 'Active' : 'Inactive';
      
      // Find the latest invoice date
      let lastInvoice = null;
      if (client.invoices.length > 0) {
        const sortedInvoices = [...client.invoices].sort((a, b) => 
          new Date(b.issueDate) - new Date(a.issueDate)
        );
        lastInvoice = sortedInvoices[0].issueDate;
      }
      
      // Return client with financial metrics and without the full arrays
      return {
        ...client,
        totalBilled,
        outstandingAmount,
        lastInvoice,
        status: clientStatus,
        invoices: undefined, // Remove the full invoices array to reduce payload size
        sales: undefined // Remove the full sales array to reduce payload size
      };
    });
    
    // Return clients with pagination metadata (matching inventory structure)
    return NextResponse.json({
      clients: clientsWithMetrics,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clients. Please try again.' },
      { status: 500 }
    );
  }
}

// POST - Create a new client
export async function POST(request) {
  try {
    // Check for standard access (trial or paid subscription)
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
    
    const body = await request.json();
    
    // Validate required fields - only name is mandatory
    if (!body.name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }
    
    // Check if email is already registered for this tenant (only if email is provided)
    if (body.email && body.email.trim()) {
      const existingClient = await prisma.client.findFirst({
        where: { 
          email: body.email,
          tenantId: user.tenantId
        }
      });
      
      if (existingClient) {
        return NextResponse.json(
          { error: 'A client with this email is already registered' },
          { status: 400 }
        );
      }
    }
    
    // Parse additionalEmails: accept array or string (comma, newline, or semicolon separated)
    const parseAdditionalEmails = (v) => {
      if (!v) return [];
      if (Array.isArray(v)) return v.map((e) => String(e).trim()).filter(Boolean);
      return String(v).split(/[\n,;]+/).map((e) => e.trim()).filter(Boolean);
    };

    // Create the client
    const client = await prisma.client.create({
      data: {
        name: body.name,
        contactPerson: body.contactPerson || null,
        email: body.email && body.email.trim() ? body.email.trim() : null,
        additionalEmails: parseAdditionalEmails(body.additionalEmails),
        phone: body.phone && body.phone.trim() ? body.phone : null,
        address: body.address || null,
        tenant: { connect: { id: user.tenantId } }
      }
    });
    
    // Create an audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'CLIENT_CREATED',
        entityType: 'CLIENT',
        entityId: client.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          name: client.name,
          email: client.email
        })
      }
    });
    
    // Return the created client
    return NextResponse.json(
      { 
        message: 'Client created successfully',
        client: {
          ...client,
          totalBilled: 0,
          outstandingAmount: 0,
          status: 'Active'
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json(
      { error: 'Failed to create client. Please try again.' },
      { status: 500 }
    );
  }
}