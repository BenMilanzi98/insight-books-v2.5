// app/api/clients/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requireAnyPermission, requirePermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { parseClientIsActive } from '@/lib/clientStatus';
import { buildClientMetrics } from '@/lib/clientMetrics';

// GET - Fetch clients with optional filtering, sorting, and pagination
export async function GET(request) {
  try {
    const perm = await requireAnyPermission(request, [
      'clients.view',
      'sales.view',
      'sales.create',
      'sales.update',
    ]);
    if (perm) return perm;

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
    const statusFilter = searchParams.get('status');
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Build filter object for Prisma
    const where = {
      tenantId: user.tenantId, // Filter by tenant ID for multi-tenancy
    };

    // Filter by persisted Active/Inactive (not invoice activity)
    if (statusFilter && statusFilter !== 'All') {
      where.isActive = parseClientIsActive(statusFilter, true);
    }
    
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
        isActive: true,
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
    
    // Financial metrics + persisted status (Active/Inactive from isActive)
    const clientsWithMetrics = clients.map((client) => buildClientMetrics(client));
    
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
      {
        error: 'Failed to fetch clients. Please try again.',
        ...(process.env.NODE_ENV === 'development'
          ? { detail: error?.message || String(error) }
          : {}),
      },
      { status: 500 }
    );
  }
}

// POST - Create a new client
export async function POST(request) {
  try {
    const perm = await requireAnyPermission(request, [
      'clients.create',
      'sales.create',
      'sales.update',
    ]);
    if (perm) return perm;

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

    const isActive = parseClientIsActive(body.status ?? body.isActive, true);

    // Create the client
    const client = await prisma.client.create({
      data: {
        name: body.name,
        contactPerson: body.contactPerson || null,
        email: body.email && body.email.trim() ? body.email.trim() : null,
        additionalEmails: parseAdditionalEmails(body.additionalEmails),
        phone: body.phone && body.phone.trim() ? body.phone : null,
        address: body.address || null,
        isActive,
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
          email: client.email,
          isActive: client.isActive
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
          totalPaid: 0,
          outstandingAmount: 0,
          invoiceCount: 0,
          salesCount: 0,
          status: isActive ? 'Active' : 'Inactive'
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