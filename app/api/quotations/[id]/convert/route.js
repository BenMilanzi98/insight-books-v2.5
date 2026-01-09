// app/api/quotations/[id]/convert/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// POST - Convert a quotation to an invoice
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
    
    // Await params for Next.js 15 compatibility
    const { id: quotationId } = await params;
    
    // Check if the quotation exists and belongs to the user's tenant
    const quotation = await prisma.quotation.findFirst({
      where: {
        id: quotationId,
        tenantId: user.tenantId
      },
      include: {
        client: true,
        items: true
      }
    });
    
    if (!quotation) {
      return NextResponse.json(
        { error: 'Quotation not found' },
        { status: 404 }
      );
    }
    
    // Check if the quotation can be converted (status should be Approved)
    if (quotation.status !== 'Approved') {
      return NextResponse.json(
        { error: 'Only approved quotations can be converted to invoices' },
        { status: 400 }
      );
    }
    
    // Check if the quotation has already been converted
    if (quotation.status === 'Converted') {
      return NextResponse.json(
        { error: 'This quotation has already been converted to an invoice' },
        { status: 400 }
      );
    }
    
    // Parse the request body for any additional data
    let additionalData = {};
    try {
      additionalData = await request.json();
    } catch (e) {
      // No additional data provided, continue with default values
    }
    
    // Generate invoice number with continuous sequential numbering
    // Format: INV-DDMMYYYY-00010 (date changes, but number never resets)
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const dateStr = `${day}${month}${year}`; // DDMMYYYY format
    
    // Get tenant settings for invoice prefix
    const tenantSettings = await prisma.tenantSettings.findFirst({
      where: { tenantId: user.tenantId }
    });
    
    const invoicePrefix = tenantSettings?.invoicePrefix || 'INV';
    
    // Get the last invoice for this tenant to extract the sequential number
    // The sequential number should NEVER reset, it continues infinitely
    const lastInvoice = await prisma.invoice.findFirst({
      where: {
        tenantId: user.tenantId
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        invoiceNumber: true
      }
    });
    
    let sequentialNumber = 1; // Default to 1 if no invoices exist
    
    if (lastInvoice && lastInvoice.invoiceNumber) {
      // Extract the sequential number from the last invoice
      // Format: INV-DDMMYYYY-00010 or INV-YYYYMM-001 (old format)
      const parts = lastInvoice.invoiceNumber.split('-');
      if (parts.length >= 3) {
        // Get the last part which should be the sequential number
        const lastPart = parts[parts.length - 1];
        const parsedNumber = parseInt(lastPart, 10);
        if (!isNaN(parsedNumber) && parsedNumber > 0) {
          sequentialNumber = parsedNumber + 1; // Increment by 1
        }
      }
    }
    
    // Format sequential number with 5 digits (00010, 00011, etc.)
    const sequentialNumberStr = String(sequentialNumber).padStart(5, '0');
    const invoiceNumber = `${invoicePrefix}-${dateStr}-${sequentialNumberStr}`;
    
    // Create the invoice based on the quotation data
    const newInvoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        clientId: quotation.clientId,
        createdById: user.id,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default 30 days
        discount: quotation.discount,
        subtotal: quotation.subtotal,
        taxAmount: quotation.taxAmount,
        total: quotation.total,
        status: 'Pending', // Default status for new invoices
        notes: `${quotation.notes ? quotation.notes + '\n\n' : ''}Generated from quotation ${quotation.quotationNumber}.`,
        tenantId: user.tenantId,
        items: {
          create: quotation.items.map(item => ({
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
    
    // Update the quotation status to 'Converted'
    await prisma.quotation.update({
      where: { id: quotationId },
      data: {
        status: 'Converted',
        notes: `${quotation.notes ? quotation.notes + ' ' : ''}Converted to invoice ${invoiceNumber}.`
      }
    });
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'QUOTATION_CONVERTED',
        entityType: 'QUOTATION',
        entityId: quotationId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          quotationNumber: quotation.quotationNumber,
          invoiceNumber,
          clientId: quotation.clientId,
          total: quotation.total
        })
      }
    });
    
    // Format the response
    const formattedInvoice = {
      id: newInvoice.id,
      invoiceNumber: newInvoice.invoiceNumber,
      client: newInvoice.client.name,
      clientId: newInvoice.clientId,
      issueDate: newInvoice.issueDate.toISOString().split('T')[0],
      dueDate: newInvoice.dueDate.toISOString().split('T')[0],
      amount: newInvoice.total.toLocaleString(),
      discount: newInvoice.discount.toLocaleString(),
      subtotal: newInvoice.subtotal.toLocaleString(),
      taxAmount: newInvoice.taxAmount.toLocaleString(),
      status: newInvoice.status,
      notes: newInvoice.notes,
      items: newInvoice.items.map(item => ({
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
      message: 'Quotation successfully converted to invoice',
      invoice: formattedInvoice,
      invoiceId: newInvoice.id,
      invoiceNumber: newInvoice.invoiceNumber
    });
  } catch (error) {
    console.error(`Error converting quotation to invoice:`, error);
    return NextResponse.json(
      { error: 'Failed to convert quotation to invoice. Please try again.' },
      { status: 500 }
    );
  }
}