// app/api/quotations/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// Enhanced helper function to calculate quotation totals with discounts
function calculateQuotationTotals(items, globalDiscount = 0) {
  let subtotal = 0;
  let totalDiscountAmount = 0;
  
  const processedItems = items.map(item => {
    // Calculate line total before discount
    const lineTotal = item.quantity * item.unitPrice;
    
    // Interpret discountAmount as per-item discount; convert to line discount
    const perItemDiscount = item.discountAmount || 0;
    const lineDiscountAmount = perItemDiscount * item.quantity;
    
    // Calculate net amount after discount
    const netLineAmount = lineTotal - lineDiscountAmount;
    
    // Calculate tax on net amount
    const lineTaxAmount = netLineAmount * ((item.taxRate || 0) / 100);
    
    // Calculate final amount including tax
    const finalAmount = netLineAmount + lineTaxAmount;
    
    // Add to totals
    subtotal += lineTotal;
    totalDiscountAmount += lineDiscountAmount;
    
    return {
      ...item,
      // Persist per-item discount for each item
      discountAmount: Number(perItemDiscount.toFixed(2)),
      netAmount: Number(netLineAmount.toFixed(2)),
      amount: Number(finalAmount.toFixed(2))
    };
  });
  
  // Apply global discount to the net subtotal (after line item discounts)
  const netSubtotalBeforeGlobal = subtotal - totalDiscountAmount;
  const validGlobalDiscount = Math.max(0, Math.min(globalDiscount || 0, netSubtotalBeforeGlobal));
  
  // Calculate tax on the net amount after global discount
  const finalNetSubtotal = netSubtotalBeforeGlobal - validGlobalDiscount;
  
  // Calculate total tax from processed items (this should already include line item taxes)
  let totalTaxAmount = 0;
  processedItems.forEach(item => {
    const lineTotal = item.quantity * item.unitPrice;
    const perItemDiscount = item.discountAmount || 0;
    const lineDiscountAmount = perItemDiscount * item.quantity;
    const netLineAmount = lineTotal - lineDiscountAmount;
    totalTaxAmount += netLineAmount * ((item.taxRate || 0) / 100);
  });
  
  const total = finalNetSubtotal + totalTaxAmount;
  
  return {
    processedItems,
    subtotal: Number(subtotal.toFixed(2)),
    totalDiscountAmount: Number(totalDiscountAmount.toFixed(2)),
    globalDiscount: Number(validGlobalDiscount.toFixed(2)),
    taxAmount: Number(totalTaxAmount.toFixed(2)),
    total: Number(total.toFixed(2))
  };
}

// GET - Fetch quotations with filtering, sorting, and pagination
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
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const status = searchParams.get('status');
    const clientId = searchParams.get('clientId');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Build filter object for Prisma
    const where = {
      tenantId: user.tenantId
    };
    
    // Add status filter if provided
    if (status) {
      where.status = status;
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
          { error: 'All items must have valid description, quantity, and unit price' },
          { status: 400 }
        );
      }
      
      // Validate per-item discount amount (should be non-negative and not exceed unit price)
      if (item.discountAmount && item.discountAmount < 0) {
        return NextResponse.json(
          { error: 'Discount amount must be positive' },
          { status: 400 }
        );
      }
      
      if (item.discountAmount && item.discountAmount > item.unitPrice) {
        return NextResponse.json(
          { error: 'Per-item discount cannot exceed unit price' },
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

    // Generate quotation number with continuous sequential numbering
    // Format: QUO-DDMMYYYY-00010 (date changes, but number never resets)
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const dateStr = `${day}${month}${year}`; // DDMMYYYY format
    
    // Get tenant settings for quotation prefix (optional; avoid 500 if TenantSettings has issues)
    let tenantSettings = null;
    try {
      tenantSettings = await prisma.tenantSettings.findFirst({
        where: { tenantId: user.tenantId }
      });
    } catch (_) {
      // use defaults below
    }
    
    // Use 'QUO' as default prefix (quotationPrefix not in settings, but could be added later)
    const quotationPrefix = 'QUO';
    
    // Get the last quotation for this tenant to extract the sequential number
    // The sequential number should NEVER reset, it continues infinitely
    const lastQuotation = await prisma.quotation.findFirst({
      where: {
        tenantId: user.tenantId
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        quotationNumber: true
      }
    });
    
    let sequentialNumber = 1; // Default to 1 if no quotations exist
    
    if (lastQuotation && lastQuotation.quotationNumber) {
      // Extract the sequential number from the last quotation
      // Format: QUO-DDMMYYYY-00010 or QT-001 (old format)
      const parts = lastQuotation.quotationNumber.split('-');
      if (parts.length >= 3) {
        // Get the last part which should be the sequential number
        const lastPart = parts[parts.length - 1];
        const parsedNumber = parseInt(lastPart, 10);
        if (!isNaN(parsedNumber) && parsedNumber > 0) {
          sequentialNumber = parsedNumber + 1; // Increment by 1
        }
      } else if (parts.length === 2) {
        // Handle old format: QT-001
        const lastPart = parts[1];
        const parsedNumber = parseInt(lastPart, 10);
        if (!isNaN(parsedNumber) && parsedNumber > 0) {
          sequentialNumber = parsedNumber + 1; // Increment by 1
        }
      }
    }
    
    // Format sequential number with 5 digits (00010, 00011, etc.)
    const sequentialNumberStr = String(sequentialNumber).padStart(5, '0');
    const quotationNumber = `${quotationPrefix}-${dateStr}-${sequentialNumberStr}`;
    
    // Create the quotation
    const newQuotation = await prisma.quotation.create({
      data: {
        quotationNumber,
        title: body.title || 'Quotation',
        orderNumber: body.orderNumber || null,
        clientId: body.clientId,
        createdById: user.id,
        issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
        validUntil: body.validUntil ? new Date(body.validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
        discount: body.discount || 0, // Legacy global discount
        subtotal: calculations.subtotal,
        taxAmount: calculations.taxAmount,
        totalDiscountAmount: calculations.totalDiscountAmount, // Enhanced: Total of all line item discounts
        total: calculations.total,
        status: body.status || 'Draft',
        notes: body.notes,
        tenantId: user.tenantId,
        items: {
          create: calculations.processedItems.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: Number(item.taxRate || 0), // Convert to number
            discountRate: 0, // Legacy field, keep for backward compatibility
            discountAmount: item.discountAmount || 0,
            netAmount: item.netAmount || 0,
            amount: item.amount,
            productId: item.productId || null
          }))
        }
      },
      include: {
        client: true,
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
            quotationNumber,
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