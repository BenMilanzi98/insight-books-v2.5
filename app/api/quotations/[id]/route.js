// app/api/quotations/[id]/route.js
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

// GET - Fetch a single quotation by ID
export async function GET(request, { params }) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Await params for Next.js 15 compatibility
    const { id: quotationId } = await params;
    
    // Check if quotation exists and belongs to the user's tenant
    const quotation = await prisma.quotation.findFirst({
      where: {
        id: quotationId,
        tenantId: user.tenantId
      },
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
    
    if (!quotation) {
      return NextResponse.json(
        { error: 'Quotation not found' },
        { status: 404 }
      );
    }
    
    // Format the result for the frontend
    const formattedQuotation = {
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
      amount: quotation.total,
      discount: quotation.discount,
      subtotal: quotation.subtotal,
      taxAmount: quotation.taxAmount,
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
    };
    
    return NextResponse.json(formattedQuotation);
  } catch (error) {
    console.error(`Error fetching quotation ${quotationId}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch quotation. Please try again.' },
      { status: 500 }
    );
  }
}

// PUT - Update a quotation
export async function PUT(request, { params }) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Await params for Next.js 15 compatibility
    const { id: quotationId } = await params;
    const body = await request.json();
    
    // Check if quotation exists and belongs to the user's tenant
    const existingQuotation = await prisma.quotation.findFirst({
      where: {
        id: quotationId,
        tenantId: user.tenantId
      }
    });
    
    if (!existingQuotation) {
      return NextResponse.json(
        { error: 'Quotation not found' },
        { status: 404 }
      );
    }
    
    // Check if the quotation can be updated (not allowed if already converted)
    if (existingQuotation.status === 'Converted') {
      return NextResponse.json(
        { error: 'Cannot update a quotation that has been converted to an invoice' },
        { status: 400 }
      );
    }
    
    // Calculate totals
    const { processedItems, subtotal, totalDiscountAmount, globalDiscount, taxAmount, total } = calculateQuotationTotals(body.items, body.discount);
    
    // Update the quotation
    const updatedQuotation = await prisma.$transaction(async (prisma) => {
      // Delete existing items
      await prisma.quotationItem.deleteMany({
        where: { quotationId }
      });
      
      // Update the quotation
      return prisma.quotation.update({
        where: { id: quotationId },
        data: {
          title: body.title || existingQuotation.title,
          clientId: body.clientId || existingQuotation.clientId,
          issueDate: body.issueDate ? new Date(body.issueDate) : existingQuotation.issueDate,
          validUntil: body.validUntil ? new Date(body.validUntil) : existingQuotation.validUntil,
          discount: body.discount || existingQuotation.discount,
          subtotal: subtotal,
          taxAmount: taxAmount,
          totalDiscountAmount: totalDiscountAmount, // Enhanced: Total of all line item discounts
          total: total,
          status: body.status || existingQuotation.status,
          notes: body.notes,
          items: {
            create: processedItems.map(item => ({
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
          items: true
        }
      });
    });
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'QUOTATION_UPDATED',
        entityType: 'QUOTATION',
        entityId: quotationId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          quotationNumber: updatedQuotation.quotationNumber,
          clientId: updatedQuotation.clientId,
          total: updatedQuotation.total
        })
      }
    });
    
    // Format the response
    const formattedQuotation = {
      id: updatedQuotation.id,
      quotationNumber: updatedQuotation.quotationNumber,
      title: updatedQuotation.title,
      client: updatedQuotation.client.name,
      clientId: updatedQuotation.clientId,
      date: updatedQuotation.issueDate.toISOString().split('T')[0],
      validUntil: updatedQuotation.validUntil.toISOString().split('T')[0],
      amount: updatedQuotation.total.toLocaleString(),
      discount: updatedQuotation.discount.toLocaleString(),
      subtotal: updatedQuotation.subtotal.toLocaleString(),
      taxAmount: updatedQuotation.taxAmount.toLocaleString(),
      status: updatedQuotation.status,
      notes: updatedQuotation.notes,
      items: updatedQuotation.items.map(item => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        amount: item.amount,
        productId: item.productId
      }))
    };
    
    return NextResponse.json({
      message: 'Quotation updated successfully',
      quotation: formattedQuotation
    });
  } catch (error) {
    console.error(`Error updating quotation ${quotationId}:`, error);
    return NextResponse.json(
      { error: 'Failed to update quotation. Please try again.' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a quotation
export async function DELETE(request, { params }) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Await params for Next.js 15 compatibility
    const { id: quotationId } = await params;
    
    // Check if quotation exists and belongs to the user's tenant
    const existingQuotation = await prisma.quotation.findFirst({
      where: {
        id: quotationId,
        tenantId: user.tenantId
      }
    });
    
    if (!existingQuotation) {
      return NextResponse.json(
        { error: 'Quotation not found' },
        { status: 404 }
      );
    }
    
    // Check if the quotation can be deleted (not allowed if already converted)
    if (existingQuotation.status === 'Converted') {
      return NextResponse.json(
        { error: 'Cannot delete a quotation that has been converted to an invoice' },
        { status: 400 }
      );
    }
    
    // Delete the quotation and its items in a transaction
    await prisma.$transaction([
      // Delete quotation items
      prisma.quotationItem.deleteMany({
        where: { quotationId }
      }),
      // Delete the quotation
      prisma.quotation.delete({
        where: { id: quotationId }
      })
    ]);
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'QUOTATION_DELETED',
        entityType: 'QUOTATION',
        entityId: quotationId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          quotationNumber: existingQuotation.quotationNumber,
          clientId: existingQuotation.clientId,
          total: existingQuotation.total
        })
      }
    });
    
    return NextResponse.json({
      message: 'Quotation deleted successfully'
    });
  } catch (error) {
    console.error(`Error deleting quotation ${quotationId}:`, error);
    return NextResponse.json(
      { error: 'Failed to delete quotation. Please try again.' },
      { status: 500 }
    );
  }
}