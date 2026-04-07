// app/api/quotations/[id]/convert/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { hasEISAccess } from '@/lib/subscriptionService';
import eisService from '@/lib/eisService';
import { allocateNextDocumentNumber, formatDatedDocumentNumber } from '@/lib/documentSequences';

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
    
    const tenantSettings = await prisma.tenantSettings.findFirst({
      where: { tenantId: user.tenantId }
    });
    const invoicePrefix = tenantSettings?.invoicePrefix || 'INV';
    const issueDate = new Date();

    const newInvoice = await prisma.$transaction(async (tx) => {
      const seq = await allocateNextDocumentNumber(tx, user.tenantId, 'INV');
      const invoiceNumber = formatDatedDocumentNumber(invoicePrefix, issueDate, seq);

      const inv = await tx.invoice.create({
        data: {
          invoiceNumber,
          clientId: quotation.clientId,
          createdById: user.id,
          issueDate,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          discount: quotation.discount,
          subtotal: quotation.subtotal,
          taxAmount: quotation.taxAmount,
          total: quotation.total,
          status: 'Pending',
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

      await tx.quotation.update({
        where: { id: quotationId },
        data: {
          status: 'Converted',
          invoiceId: inv.id,
          notes: `${quotation.notes ? quotation.notes + ' ' : ''}Converted to invoice ${invoiceNumber}.`
        }
      });

      await tx.auditLog.create({
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

      return inv;
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
    
    // MRA EIS: auto-submit converted invoice to MRA for EIS-enabled tenants (fire-and-forget)
    let eisResult = null;
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { eisEnabled: true } });
      if (tenant?.eisEnabled) {
        const eisAccess = await hasEISAccess(user.tenantId);
        if (eisAccess) {
          eisResult = await eisService.submitInvoice(user.tenantId, {
            invoiceNumber: newInvoice.invoiceNumber,
            invoiceDate: newInvoice.issueDate,
            customerName: newInvoice.client?.name || quotation.client?.name || '',
            customerTPIN: '',
            items: (newInvoice.items || []).map(item => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate || 0
            })),
            subtotal: Number(newInvoice.subtotal),
            taxTotal: Number(newInvoice.taxAmount || 0),
            total: Number(newInvoice.total),
            paymentMethod: 'Bank Transfer'
          }, 'quotation-convert', newInvoice.id);
          console.log('✅ EIS: Converted invoice submitted to MRA:', eisResult?.submissionId);
        }
      }
    } catch (eisErr) {
      console.error('⚠️ EIS quotation-convert submission failed (invoice still saved):', eisErr.message);
    }

    return NextResponse.json({
      message: 'Quotation successfully converted to invoice',
      invoice: formattedInvoice,
      invoiceId: newInvoice.id,
      invoiceNumber: newInvoice.invoiceNumber,
      eis: eisResult ? { submissionId: eisResult.submissionId, status: eisResult.status } : null
    });
  } catch (error) {
    console.error(`Error converting quotation to invoice:`, error);
    if (error.code === 'P2002' && String(error.meta?.target || '').includes('invoiceNumber')) {
      return NextResponse.json(
        { error: 'Invoice number already exists for this business.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to convert quotation to invoice. Please try again.' },
      { status: 500 }
    );
  }
}