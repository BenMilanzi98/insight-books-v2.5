// app/api/quotations/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { allocateNextQuoNumberReliable, formatDatedDocumentNumber } from '@/lib/documentSequences';
import { calculateInvoiceTotals } from '@/lib/invoiceTotals';

// Enhanced helper function to calculate quotation totals with discounts
function calculateQuotationTotals(items, globalDiscount = 0) {
  const totals = calculateInvoiceTotals(items, globalDiscount);
  const processedItems = totals.processedItems.map((item, index) => ({
    ...items[index],
    discountAmount: item.discountAmount,
    netAmount: item.netAmount,
    amount: item.amount,
    taxAmount: item.taxAmount,
  }));

  return {
    processedItems,
    subtotal: totals.subtotal,
    totalDiscountAmount: totals.totalDiscountAmount,
    globalDiscount: totals.globalDiscount,
    taxAmount: totals.taxAmount,
    total: totals.total
  };
}

// GET - Fetch quotations with filtering, sorting, and pagination
export async function GET(request) {
  try {
    const perm = await requirePermission(request, 'quotations.view');
    if (perm) return perm;

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
    const status = searchParams.get('status')?.trim() || null;
    const clientId = searchParams.get('clientId')?.trim() || null;
    const search = searchParams.get('search')?.trim() || null;
    const dateFrom = searchParams.get('dateFrom')?.trim() || null;
    const dateTo = searchParams.get('dateTo')?.trim() || null;
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Build filter object for Prisma
    const where = {
      tenantId: user.tenantId
    };
    
    // Add status filter if provided (map tab/lowercase to DB values; "expired" = Expired or Rejected)
    if (status) {
      const statusLower = status.toLowerCase();
      if (statusLower === 'expired') {
        where.status = { in: ['Expired', 'Rejected'] };
      } else {
        const statusMap = {
          pending: 'Pending',
          approved: 'Approved',
          draft: 'Draft',
          converted: 'Converted',
          rejected: 'Rejected'
        };
        const dbStatus = statusMap[statusLower] || status;
        where.status = dbStatus;
      }
    }
    
    // Add client filter if provided
    if (clientId) {
      where.clientId = clientId;
    }
    
    // Add date range filters if provided
    if (dateFrom) {
      where.issueDate = {
        ...(where.issueDate || {}),
        gte: new Date(dateFrom)
      };
    }
    
    if (dateTo) {
      where.issueDate = {
        ...(where.issueDate || {}),
        lte: new Date(dateTo)
      };
    }
    
    // Add search filter if provided
    if (search) {
      where.OR = [
        { quotationNumber: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }
    
    // Get total count for pagination
    const totalCount = await prisma.quotation.count({ where });
    
    // Build sort object for Prisma
    const orderBy = {};
    
    // Map frontend field names to database field names
    const fieldMapping = {
      'date': 'issueDate',
      'validUntil': 'validUntil',
      'quotationNumber': 'quotationNumber',
      'title': 'title',
      'status': 'status',
      'createdAt': 'createdAt',
      'updatedAt': 'updatedAt'
    };
    
    // Use the mapping to get the correct field name
    const dbField = fieldMapping[sortBy] || 'createdAt';
    orderBy[dbField] = sortOrder === 'asc' ? 'asc' : 'desc';
    
    // Fetch quotations with their relations
    const quotations = await prisma.quotation.findMany({
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
            phone: true,
            contactPerson: true
          }
        },
        createdBy: { // Include user info for "Prepared By"
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        items: true
      }
    });
    
    // Format the result for the frontend
    const formattedQuotations = quotations.map(quotation => ({
      id: quotation.id,
      quotationNumber: quotation.quotationNumber,
      title: quotation.title,
      client: quotation.client.name,
      clientId: quotation.clientId,
      clientEmail: quotation.client.email,
      clientPhone: quotation.client.phone,
      contactPerson: quotation.client.contactPerson,
      preparedBy: quotation.createdBy?.name || 'N/A', // Include prepared by info
      preparedById: quotation.createdBy?.id || null,
      createdBy: quotation.createdBy, // Include full createdBy object
      createdAt: quotation.createdAt, // Include creation timestamp
      date: quotation.issueDate.toISOString().split('T')[0],
      validUntil: quotation.validUntil.toISOString().split('T')[0],
      amount: quotation.total.toLocaleString(),
      discount: quotation.discount.toLocaleString(),
      subtotal: quotation.subtotal.toLocaleString(),
      taxAmount: quotation.taxAmount.toLocaleString(),
      status: quotation.status,
      notes: quotation.notes,
      items: quotation.items.map(item => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        amount: item.amount,
        productId: item.productId
      }))
    }));
    
    // Return quotations with pagination metadata
    return NextResponse.json({
      quotations: formattedQuotations,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching quotations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quotations. Please try again.' },
      { status: 500 }
    );
  }
}

// POST - Create a new quotation
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'quotations.create');
    if (perm) return perm;

    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    
    // Validate required fields
    if (!body.clientId || !body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Client and at least one item are required' },
        { status: 400 }
      );
    }
    
    // Enhanced validation for each item
    for (const item of body.items) {
      if (!item.description || item.quantity <= 0 || item.unitPrice < 0) {
        return NextResponse.json(
          { error: 'All items must have valid description, quantity, and Selling Price' },
          { status: 400 }
        );
      }
      
      // Validate per-item discount amount (should be non-negative and not exceed Selling Price)
      if (item.discountAmount && item.discountAmount < 0) {
        return NextResponse.json(
          { error: 'Discount amount must be positive' },
          { status: 400 }
        );
      }
      
      if (item.discountAmount && item.discountAmount > item.unitPrice) {
        return NextResponse.json(
          { error: 'Per-item discount cannot exceed Selling Price' },
          { status: 400 }
        );
      }
      
      // Validate tax rate
      if (item.taxRate && (item.taxRate < 0 || item.taxRate > 100)) {
        return NextResponse.json(
          { error: 'Tax rate must be between 0 and 100%' },
          { status: 400 }
        );
      }
    }
    
    // Enhanced calculation using the new function
    const calculations = calculateQuotationTotals(body.items, body.discount || 0);

    const quotationPrefix = 'QUO';
    const issueDate = body.issueDate ? new Date(body.issueDate) : new Date();

    const newQuotation = await prisma.$transaction(async (tx) => {
      const seq = await allocateNextQuoNumberReliable(tx, user.tenantId, {
        prefix: quotationPrefix,
        issueDate,
      });
      const quotationNumber = formatDatedDocumentNumber(quotationPrefix, issueDate, seq);

      return tx.quotation.create({
        data: {
          quotationNumber,
          title: body.title || 'Quotation',
          orderNumber: body.orderNumber || null,
          clientId: body.clientId,
          createdById: user.id,
          issueDate,
          validUntil: body.validUntil ? new Date(body.validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          discount: body.discount || 0,
          subtotal: calculations.subtotal,
          taxAmount: calculations.taxAmount,
          totalDiscountAmount: calculations.totalDiscountAmount,
          total: calculations.total,
          status: body.status || 'Draft',
          notes: body.notes,
          tenantId: user.tenantId,
          footerPhoneOverride: body.footerPhoneOverride || null,
          footerBankDetailsOverride: body.footerBankDetailsOverride || null,
          items: {
            create: calculations.processedItems.map(item => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: Number(item.taxRate || 0),
              discountRate: 0,
              discountAmount: item.discountAmount || 0,
              netAmount: item.netAmount || 0,
              amount: item.amount,
              productId: item.productId || null
            }))
          }
        },
        include: {
          client: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          items: true
        }
      });
    });
    
    // Create audit log (non-blocking; do not fail the request if audit fails)
    try {
      await prisma.auditLog.create({
        data: {
          action: 'QUOTATION_CREATED',
          entityType: 'QUOTATION',
          entityId: newQuotation.id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            quotationNumber: newQuotation.quotationNumber,
            clientId: body.clientId,
            total: newQuotation.total
          })
        }
      });
    } catch (auditErr) {
      console.warn('Quotation created but audit log failed:', auditErr?.message || auditErr);
    }
    
    // Format the response
    const formattedQuotation = {
      id: newQuotation.id,
      quotationNumber: newQuotation.quotationNumber,
      title: newQuotation.title,
      client: newQuotation.client.name,
      clientId: newQuotation.clientId,
      preparedBy: newQuotation.createdBy?.name || 'N/A', // Include prepared by info
      preparedById: newQuotation.createdBy?.id || null,
      createdBy: newQuotation.createdBy, // Include full createdBy object
      createdAt: newQuotation.createdAt, // Include creation timestamp
      date: newQuotation.issueDate.toISOString().split('T')[0],
      validUntil: newQuotation.validUntil.toISOString().split('T')[0],
      amount: newQuotation.total.toLocaleString(),
      discount: newQuotation.discount.toLocaleString(),
      subtotal: newQuotation.subtotal.toLocaleString(),
      taxAmount: newQuotation.taxAmount.toLocaleString(),
      status: newQuotation.status,
      notes: newQuotation.notes,
      items: newQuotation.items.map(item => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        amount: item.amount,
        productId: item.productId
      }))
    };
    
    return NextResponse.json(
      { 
        message: 'Quotation created successfully',
        quotation: formattedQuotation
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating quotation:', error);
    if (error.code === 'P2002' && String(error.meta?.target || '').includes('quotationNumber')) {
      return NextResponse.json(
        { error: 'Quotation number already exists for this business.' },
        { status: 409 }
      );
    }
    const message = error?.message || String(error);
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json(
      {
        error: 'Failed to create quotation. Please try again.',
        ...(isDev && { details: message })
      },
      { status: 500 }
    );
  }
}