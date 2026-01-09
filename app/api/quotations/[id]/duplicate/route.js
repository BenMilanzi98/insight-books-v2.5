// app/api/quotations/[id]/duplicate/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

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
    
    // Generate quotation number with continuous sequential numbering
    // Format: QUO-DDMMYYYY-00010 (date changes, but number never resets)
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const dateStr = `${day}${month}${year}`; // DDMMYYYY format
    
    // Get tenant settings for quotation prefix (default to 'QUO' if not set)
    const tenantSettings = await prisma.tenantSettings.findFirst({
      where: { tenantId: user.tenantId }
    });
    
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
    
    // Create the duplicate quotation
    const newQuotation = await prisma.quotation.create({
      data: {
        quotationNumber,
        title: `${existingQuotation.title} (Copy)`,
        clientId: existingQuotation.clientId,
        createdById: user.id,
        issueDate: new Date(), // Current date
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        subtotal: existingQuotation.subtotal,
        taxAmount: existingQuotation.taxAmount,
        total: existingQuotation.total,
        status: 'Draft', // Always start as draft
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
          newQuotationNumber: quotationNumber
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
    return NextResponse.json(
      { error: 'Failed to duplicate quotation. Please try again.' },
      { status: 500 }
    );
  }
}