// app/api/quotations/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { calculateInvoiceTotals } from '@/lib/invoiceTotals';
import { toItemTaxCreateRows } from '@/lib/documentLineTaxes';

// Enhanced helper function to calculate quotation totals with discounts
function calculateQuotationTotals(items, globalDiscount = 0) {
  const totals = calculateInvoiceTotals(items, globalDiscount);
  const processedItems = totals.processedItems.map((item, index) => ({
    ...items[index],
    ...item,
    description: item.description ?? items[index]?.description,
    discountAmount: item.discountAmount,
    netAmount: item.netAmount,
    amount: item.amount,
    taxAmount: item.taxAmount,
    taxRate: item.taxRate,
    itemTaxes: item.itemTaxes || [],
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
        items: { include: { itemTaxes: true } }
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
      orderNumber: quotation.orderNumber ?? null,
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
      footerPhoneOverride: quotation.footerPhoneOverride ?? null,
      footerBankDetailsOverride: quotation.footerBankDetailsOverride ?? null,
      items: quotation.items.map(item => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        discountAmount: item.discountAmount,
        netAmount: item.netAmount,
        amount: item.amount,
        productId: item.productId,
        itemTaxes: item.itemTaxes || [],
        taxes: item.itemTaxes || [],
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
          orderNumber: body.orderNumber !== undefined ? body.orderNumber : existingQuotation.orderNumber,
          clientId: body.clientId || existingQuotation.clientId,
          issueDate: body.issueDate ? new Date(body.issueDate) : existingQuotation.issueDate,
          validUntil: body.validUntil ? new Date(body.validUntil) : existingQuotation.validUntil,
          discount: body.discount ?? existingQuotation.discount,
          subtotal: subtotal,
          taxAmount: taxAmount,
          totalDiscountAmount: totalDiscountAmount, // Enhanced: Total of all line item discounts
          total: total,
          status: body.status || existingQuotation.status,
          notes: body.notes,
          footerPhoneOverride: body.footerPhoneOverride !== undefined ? body.footerPhoneOverride : existingQuotation.footerPhoneOverride,
          footerBankDetailsOverride: body.footerBankDetailsOverride !== undefined ? body.footerBankDetailsOverride : existingQuotation.footerBankDetailsOverride,
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
              productId: item.productId || null,
              itemTaxes: {
                create: toItemTaxCreateRows(item.itemTaxes).filter((r) => r.taxTypeId),
              },
            }))
          }
        },
        include: {
          client: true,
          items: { include: { itemTaxes: true } }
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
        productId: item.productId,
        itemTaxes: item.itemTaxes || [],
        taxes: item.itemTaxes || [],
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