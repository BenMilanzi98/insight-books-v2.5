// app/api/invoices/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { classifyApiError } from '@/lib/apiErrorUtils';
import { addMoney, moneyGreaterOrEqual, parseMoney, subtractMoney } from '@/lib/money';
import { ensureInvoiceItemAccountIdColumn } from '@/lib/ensureInvoiceItemAccountId';
import { createInvoice } from '@/lib/invoices/createInvoice';

// GET - Fetch invoices with filtering, sorting, and pagination
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'invoices.view');
    if (perm) return perm;

    const { searchParams } = new URL(request.url);
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    await ensureInvoiceItemAccountIdColumn();
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const status = searchParams.get('status');
    const client = searchParams.get('client');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const includeDeleted = searchParams.get('includeDeleted') === 'true';
    const includeReversals = searchParams.get('includeReversals') === 'true';
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Build filter object for Prisma
    const where = {
      tenantId: user.tenantId
    };

    if (!includeDeleted) {
      where.isDeleted = false;
    }

    if (!includeReversals) {
      where.isReversal = false;
    }
    
    // Add branch filter if provided
    const branchId = searchParams.get('branchId');
    if (branchId) {
      where.branchId = branchId;
    }
    
    // Add status filter if provided (align with statistics: Pending = not yet due, Overdue = past due or status Overdue)
    if (status) {
      if (status.includes(',')) {
        where.status = {
          in: status.split(',').map(s => s.trim())
        };
      } else if (status === 'Overdue') {
        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);
        where.OR = [
          { status: 'Overdue' },
          { status: 'Pending', dueDate: { lt: startOfToday } }
        ];
      } else if (status === 'Pending') {
        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);
        where.status = 'Pending';
        where.dueDate = { gte: startOfToday };
      } else {
        where.status = status;
      }
    }
    
    // Add client filter if provided
    if (client) {
      where.clientId = client;
    }
    
    // Add date range filters
    if (dateFrom) {
      where.issueDate = {
        ...where.issueDate,
        gte: new Date(dateFrom)
      };
    }
    
    if (dateTo) {
      where.issueDate = {
        ...where.issueDate,
        lte: new Date(dateTo)
      };
    }
    
    // Add search filter
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }
    
    // Get total count for pagination
    const totalCount = await prisma.invoice.count({ where });
    
    // Build sort object - handle special cases for date fields
    let orderBy;
    // Validate sortBy field - only allow valid Invoice model fields
    const validSortFields = ['createdAt', 'updatedAt', 'issueDate', 'dueDate', 'invoiceNumber', 'total', 'status'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    orderBy = { [sortField]: sortOrder === 'asc' ? 'asc' : 'desc' };
    
    // Fetch invoices with related data
    // Fetch invoices first without items to avoid foreign key validation issues
    let invoices;
    try {
      invoices = await prisma.invoice.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          payments: {
            where: {
              status: 'Completed',
              isReversal: false
            },
            select: {
              id: true,
              amount: true,
              paymentDate: true,
              paymentMethod: true,
              reference: true,
              status: true,
              isReversal: true
            }
          }
        }
      });
    } catch (queryError) {
      console.error('❌ Error fetching invoices:', queryError);
      console.error('Error details:', {
        message: queryError.message,
        stack: queryError.stack,
        name: queryError.name,
        code: queryError.code,
        meta: queryError.meta
      });
      throw queryError;
    }
    
    // Fetch items separately to handle potential data integrity issues
    const invoiceIds = invoices.map(inv => inv.id);
    let items = [];
    if (invoiceIds.length > 0) {
      try {
        items = await prisma.invoiceItem.findMany({
          where: {
            invoiceId: { in: invoiceIds }
          },
          select: {
            id: true,
            invoiceId: true,
            accountId: true,
            description: true,
            quantity: true,
            unitPrice: true,
            taxRate: true,
            amount: true,
            productId: true,
            discountAmount: true,
            discountRate: true,
            netAmount: true,
            itemTaxes: true,
          }
        });
      } catch (itemsError) {
        console.error('❌ Error fetching invoice items:', itemsError);
        console.error('Items error details:', {
          message: itemsError.message,
          stack: itemsError.stack,
          name: itemsError.name,
          code: itemsError.code
        });
        // Continue without items rather than failing completely
        items = [];
      }
    }
    
    // Group items by invoiceId (expose taxes aliases for the invoice editor UI)
    const itemsByInvoice = items.reduce((acc, item) => {
      if (!acc[item.invoiceId]) {
        acc[item.invoiceId] = [];
      }
      acc[item.invoiceId].push({
        ...item,
        taxes: item.itemTaxes || [],
        productTaxes: item.itemTaxes || [],
      });
      return acc;
    }, {});
    
    // Attach items to invoices
    const invoicesWithFilteredItems = invoices.map(invoice => ({
      ...invoice,
      items: itemsByInvoice[invoice.id] || []
    }));
    
    // Calculate amount due for each invoice and format response
    const invoicesWithAmountDue = invoicesWithFilteredItems.map(invoice => {
      const total = parseMoney(invoice.total);
      const subtotal = parseMoney(invoice.subtotal);
      const taxAmount = parseMoney(invoice.taxAmount);
      const totalDiscountAmount = parseMoney(invoice.totalDiscountAmount);
      const totalPaid = invoice.payments?.reduce((sum, payment) => addMoney(sum, payment.amount), 0) || 0;
      const outstandingAmount = subtractMoney(total, totalPaid);
      const isFullyPaid = moneyGreaterOrEqual(totalPaid, total);
      const isPartiallyPaid = totalPaid > 0 && !isFullyPaid;
      
      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientId: invoice.clientId,
        client: invoice.client,
        preparedBy: invoice.createdBy?.name || 'N/A', // Include prepared by info
        preparedById: invoice.createdBy?.id || null,
        createdBy: invoice.createdBy, // Include full createdBy object
        createdAt: invoice.createdAt, // Include creation timestamp
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        discount: parseMoney(invoice.discount),
        subtotal,
        taxAmount,
        totalDiscountAmount, // Enhanced: Total discount amount
        total,
        status: invoice.status,
        notes: invoice.notes,
        items: invoice.items,
        payments: invoice.payments,
        amountDue: Math.max(0, outstandingAmount),
        remainingBalance: Math.max(0, outstandingAmount),
        totalPaid,
        paymentInfo: {
          totalPaid,
          outstandingAmount,
          isFullyPaid,
          isPartiallyPaid,
          paymentCount: invoice.payments?.length || 0
        },
        updatedAt: invoice.updatedAt
      };
    });
    
    // Return invoices with pagination metadata
    return NextResponse.json({
      invoices: invoicesWithAmountDue,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    return NextResponse.json(
      { 
        error: 'Failed to fetch invoices. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// POST - Create a new invoice
// Implementation lives in lib/invoices/createInvoice.js so this route and the
// desktop outbox share one revenue/COGS posting path.
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'invoices.create');
    if (perm) return perm;

    const body = await request.json();

    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const invoice = await createInvoice({ user, body });

    return NextResponse.json(
      {
        message: 'Invoice created successfully',
        invoice
      },
      { status: 201 }
    );
  } catch (error) {
    if (error?.name === 'ServiceHttpError') {
      return NextResponse.json(error.body, { status: error.status });
    }

    console.error('❌ Error creating invoice:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      meta: error.meta,
    });

    if (error.code === 'P2002' && String(error.meta?.target || '').includes('invoiceNumber')) {
      return NextResponse.json(
        { error: 'Invoice number already exists for this business.' },
        { status: 409 },
      );
    }

    const mapped = classifyApiError(error, {
      fallback: 'Failed to create invoice. Please try again.',
    });

    return NextResponse.json(
      {
        error: mapped.error,
        code: error.code || undefined,
      },
      { status: mapped.status },
    );
  }
}

