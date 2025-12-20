import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

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
    const { id: invoiceId } = await params;
    
    // Check if invoice exists and belongs to user's tenant
    const invoice = await prisma.invoice.findUnique({
      where: {
        id: invoiceId,
        tenantId: user.tenantId
      }
    });
    
    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }
    
    // Only allow deletion if invoice is in Draft or Pending status
    if (invoice.status !== 'Draft' && invoice.status !== 'Pending') {
      return NextResponse.json(
        { error: 'Cannot delete invoices that are Paid or Overdue' },
        { status: 400 }
      );
    }
    
    // Delete invoice and related items in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete invoice items first
      await tx.invoiceItem.deleteMany({
        where: { invoiceId }
      });
      
      // Delete the invoice
      await tx.invoice.delete({
        where: { id: invoiceId }
      });
      
      // Create audit log
      await tx.auditLog.create({
        data: {
          action: 'INVOICE_DELETED',
          entityType: 'INVOICE',
          entityId: invoiceId,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            invoiceNumber: invoice.invoiceNumber,
            clientId: invoice.clientId,
            total: invoice.total
          })
        }
      });
    });
    
    return NextResponse.json({
      message: 'Invoice deleted successfully'
    });
  } catch (error) {
    console.error(`Error deleting invoice ${invoiceId}:`, error);
    return NextResponse.json(
      { error: 'Failed to delete invoice. Please try again.' },
      { status: 500 }
    );
  }
}

