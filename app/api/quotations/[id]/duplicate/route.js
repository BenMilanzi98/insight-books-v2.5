// app/api/quotations/[id]/duplicate/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { allocateNextDocumentNumber, formatDatedDocumentNumber } from '@/lib/documentSequences';

// POST - Duplicate a quotation
export async function POST(request, { params }) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    const paramsData= await params;
    const quotationId = paramsData.id;
    
    // Check if quotation exists and belongs to the user's tenant
    const existingQuotation = await prisma.quotation.findFirst({
      where: {
        id: quotationId,
        tenantId: user.tenantId
      },
      include: {
        items: true,
        client: true
      }
    });
    
    if (!existingQuotation) {
      return NextResponse.json(
        { error: 'Quotation not found' },
        { status: 404 }
      );
    }
    
    const quotationPrefix = 'QUO';
    const issueDate = new Date();

    const newQuotation = await prisma.$transaction(async (tx) => {
      const seq = await allocateNextDocumentNumber(tx, user.tenantId, 'QUO');
      const quotationNumber = formatDatedDocumentNumber(quotationPrefix, issueDate, seq);

      return tx.quotation.create({
        data: {
          quotationNumber,
          title: `${existingQuotation.title} (Copy)`,
          clientId: existingQuotation.clientId,
          createdById: user.id,
          issueDate,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          subtotal: existingQuotation.subtotal,
          taxAmount: existingQuotation.taxAmount,
          total: existingQuotation.total,
          status: 'Draft',
          notes: existingQuotation.notes,
          tenantId: user.tenantId,
          items: {
            create: existingQuotation.items.map(item => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate,
              amount: item.amount,
              productId: item.productId
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
        action: 'QUOTATION_DUPLICATED',
        entityType: 'QUOTATION',
        entityId: newQuotation.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          originalQuotationId: quotationId,
          originalQuotationNumber: existingQuotation.quotationNumber,
          newQuotationNumber: newQuotation.quotationNumber
        })
      }
    });
    
    // Format the response
    const formattedQuotation = {
      id: newQuotation.id,
      quotationNumber: newQuotation.quotationNumber,
      title: newQuotation.title,
      client: newQuotation.client.name,
      clientId: newQuotation.clientId,
      date: newQuotation.issueDate.toISOString().split('T')[0],
      validUntil: newQuotation.validUntil.toISOString().split('T')[0],
      amount: newQuotation.total.toLocaleString(),
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
    
    return NextResponse.json({
      message: 'Quotation duplicated successfully',
      quotation: formattedQuotation
    });
  } catch (error) {
    console.error(`Error duplicating quotation ${paramsData.id}:`, error);
    if (error.code === 'P2002' && String(error.meta?.target || '').includes('quotationNumber')) {
      return NextResponse.json(
        { error: 'Quotation number already exists for this business.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to duplicate quotation. Please try again.' },
      { status: 500 }
    );
  }
}