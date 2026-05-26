import prisma from '@/lib/prisma';
import { deleteInvoicePdf } from '@/lib/invoicePdfStorage';
import { createInvoiceReversal } from '@/lib/transactionReversalService';

/**
 * Deletes an invoice from the active workflow while preserving an audit trail.
 * Posted invoices are reversed first; drafts are only soft-deleted because they have no GL impact.
 */
export async function reverseAndDeleteInvoiceRecord({ invoice, tenantId, userId, request, reason }) {
  const invoiceId = invoice.id;
  const statusNorm = String(invoice.status || '').toLowerCase();
  const deletionReason = (reason || 'Invoice deleted by user').trim();

  if (invoice.isDeleted) {
    const err = new Error('Invoice has already been deleted');
    err.statusCode = 400;
    throw err;
  }

  if (Number(invoice.totalPaid || 0) > 0) {
    const err = new Error(
      'Cannot delete an invoice with payments applied. Process a refund or void the invoice instead.'
    );
    err.statusCode = 400;
    throw err;
  }

  if (invoice.isReversal) {
    const err = new Error('Reversal invoices cannot be deleted');
    err.statusCode = 400;
    throw err;
  }

  let reversalResult = null;
  if (statusNorm !== 'draft') {
    reversalResult = await createInvoiceReversal({
      invoiceId,
      reversalReason: deletionReason,
      userId,
      tenantId,
    });
  }

  const deletedAt = new Date();
  const deletedInvoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      isDeleted: true,
      deletedAt,
      deletedById: userId,
      deletionReason,
      status: 'deleted',
      updatedAt: deletedAt,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: 'INVOICE_DELETE_REVERSED',
      entityType: 'INVOICE',
      entityId: invoiceId,
      userId,
      tenantId,
      details: JSON.stringify({
        invoiceNumber: invoice.invoiceNumber,
        clientId: invoice.clientId,
        originalStatus: invoice.status,
        deletionReason,
        reversalInvoiceId: reversalResult?.reversal?.id || null,
        reversalInvoiceNumber: reversalResult?.reversal?.invoiceNumber || null,
        invoiceGlReversals: reversalResult?.invoiceGlReversals || [],
        taxReversals: reversalResult?.taxReversals || [],
      }),
      ipAddress:
        request?.headers?.get('x-forwarded-for') ||
        request?.headers?.get('x-real-ip') ||
        'unknown',
    },
  });

  try {
    deleteInvoicePdf(invoiceId, invoice.invoiceNumber);
  } catch {
    // non-fatal
  }

  return { deletedInvoice, reversal: reversalResult?.reversal || null };
}
