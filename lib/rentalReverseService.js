import { voidPostedInvoice as defaultVoidPostedInvoice } from '@/lib/invoiceVoidService.js';
import { resolveOutboundInvoiceSource } from '@/lib/rentalSourceTags.js';

const DRAFT_INVOICE_STATUS = 'draft';
const VOID_INVOICE_STATUS = 'void';

function totalCompletedPayments(invoice) {
  return (invoice?.payments || []).reduce((total, payment) => total + Number(payment.amount || 0), 0);
}

export async function reverseRentalBooking({
  prisma,
  tenantId,
  userId,
  transactionId,
  reason,
  voidPostedInvoice = defaultVoidPostedInvoice,
}) {
  const rentalTransaction = await prisma.rentalTransaction.findFirst({
    where: { id: transactionId, tenantId },
    include: {
      items: { include: { rentalAsset: true } },
      invoice: { include: { payments: { where: { status: 'Completed' } } } },
    },
  });

  if (!rentalTransaction) {
    return { ok: false, code: 'NOT_FOUND', error: 'Transaction not found' };
  }

  if (rentalTransaction.status === 'cancelled') {
    return {
      ok: true,
      transactionId,
      alreadyReversed: true,
      invoiceAction: 'already_cancelled',
      invoiceId: rentalTransaction.invoiceId,
    };
  }

  if (rentalTransaction.status === 'completed') {
    return {
      ok: false,
      code: 'CLOSED',
      error: 'Completed bookings cannot be reversed here',
    };
  }

  if (totalCompletedPayments(rentalTransaction.invoice) > 0) {
    return {
      ok: false,
      code: 'NEED_CREDIT_REFUND',
      error: 'Invoice has payments. Process a refund or credit before reversing this booking.',
    };
  }

  return prisma.$transaction(async (tx) => {
    const invoice = rentalTransaction.invoice;
    const invoiceStatus = String(invoice?.status || '').toLowerCase();
    const shouldDeleteInvoice = !invoice || invoiceStatus === DRAFT_INVOICE_STATUS;
    const invoiceAlreadyVoided = invoiceStatus === VOID_INVOICE_STATUS;
    const invoiceAction = shouldDeleteInvoice ? 'deleted_draft' : 'voided';

    if (shouldDeleteInvoice) {
      if (invoice) {
        await tx.invoice.delete({ where: { id: invoice.id } });
      }
    } else if (!invoiceAlreadyVoided) {
      try {
        await voidPostedInvoice({
          db: tx,
          invoice,
          invoiceId: invoice.id,
          tenantId,
          userId,
          reason,
          requireJournals: false,
        });
      } catch (voidErr) {
        if (voidErr.code === 'NO_V2_JOURNAL_TO_REVERSE') {
          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              status: 'void',
              voidedAt: new Date(),
              voidedById: userId,
              voidReason: reason,
            },
          });
        } else {
          throw voidErr;
        }
      }
    }

    await tx.rentalAssetAvailability.deleteMany({
      where: { rentalTransactionId: transactionId },
    });

    for (const item of rentalTransaction.items) {
      if (item.rentalAsset?.kind === 'rental') {
        await tx.rentalAsset.update({
          where: { id: item.rentalAssetId },
          data: { status: 'available' },
        });
      }
    }

    const updateData = {
      status: 'cancelled',
      ...(shouldDeleteInvoice ? { invoiceId: null } : {}),
    };
    await tx.rentalTransaction.update({
      where: { id: transactionId },
      data: updateData,
    });

    await tx.auditLog.create({
      data: {
        action: 'RENTAL_BOOKING_REVERSED',
        entityType: 'RENTAL_TRANSACTION',
        entityId: transactionId,
        userId,
        tenantId,
        details: JSON.stringify({
          reason,
          invoiceAction,
          invoiceId: shouldDeleteInvoice ? null : invoice.id,
          source: resolveOutboundInvoiceSource(rentalTransaction.kind),
        }),
      },
    });

    return {
      ok: true,
      transactionId,
      invoiceAction,
      invoiceId: shouldDeleteInvoice ? null : invoice.id,
    };
  });
}
