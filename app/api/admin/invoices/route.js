import { NextResponse } from 'next/server';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    // Verify admin authentication
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const tenantId = searchParams.get('tenantId');
    const limit = parseInt(searchParams.get('limit')) || 100;

    // Build where clause
    let whereClause = {};
    if (status !== 'all') {
      whereClause.status = status;
    }
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }

    // Fetch real invoices from database
    const invoices = await prisma.invoice.findMany({
      where: whereClause,
      include: {
        tenant: {
          select: {
            id: true,
            name: true
          }
        },
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    // Transform data for frontend
    const transformedInvoices = invoices.map(invoice => ({
      id: invoice.id,
      number: invoice.invoiceNumber,
      tenantName: invoice.tenant?.name || 'No Tenant',
      tenantId: invoice.tenantId,
      clientName: invoice.client?.name || 'No Client',
      clientEmail: invoice.client?.email || 'No Email',
      createdBy: invoice.createdBy?.name || 'Unknown',
      amount: invoice.total,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      discount: invoice.discount,
      status: invoice.status,
      issueDate: invoice.issueDate.toISOString().split('T')[0],
      dueDate: invoice.dueDate.toISOString().split('T')[0],
      createdAt: invoice.createdAt.toISOString().split('T')[0],
      notes: invoice.notes
    }));

    return NextResponse.json({
      success: true,
      invoices: transformedInvoices
    });

  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 