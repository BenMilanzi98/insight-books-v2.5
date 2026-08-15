// lib/invoices/voidInvoice.js
// Extracted from the POST body of app/api/invoices/void/route.js so the route and
// the desktop outbox void through the same V2 reversal + void service path.
import prisma from '@/lib/prisma';
import { hasPermission } from '@/lib/auth';
import { isFullAccessTenantRole } from '@/lib/tenantRoleAccess';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';
import { reverseSourceJournals } from '@/lib/accountingV2/application/reverseSourceJournals.js';
import { addMoney } from '@/lib/money';
import { voidInvoiceInTransaction } from '@/lib/invoiceVoidService';
import { serviceError } from '@/lib/serviceErrors';

function invoiceVoidError(message, status) {
  return serviceError(message, { status, body: { success: false, error: message } });
}

/**
 * Void an unpaid invoice: reverse V2 journals, then mark the invoice void.
 *
 * @returns {Promise<object>} the voided invoice row.
 */
export async function voidInvoice({ user, invoiceId, reason, ipAddress = 'unknown' }) {
  if (!user?.tenantId) {
    throw invoiceVoidError('Authentication required', 401);
  }

  if (!invoiceId) {
    throw invoiceVoidError('Invoice ID is required', 400);
  }

  if (!reason || reason.trim().length < 3) {
    throw invoiceVoidError('Void reason is required (minimum 3 characters)', 400);
  }

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      tenantId: user.tenantId
    },
    include: {
      client: {
        select: { name: true, email: true }
      },
      payments: {
        where: { status: 'Completed' }
      }
    }
  });

  if (!invoice) {
    throw invoiceVoidError('Invoice not found', 404);
  }

  if (invoice.status === 'void') {
    throw invoiceVoidError('Invoice is already voided', 400);
  }

  if (invoice.status === 'refunded' || invoice.status === 'partially_refunded') {
    throw invoiceVoidError('Cannot void a refunded invoice', 400);
  }

  const totalPaid = invoice.payments.reduce((sum, payment) => addMoney(sum, payment.amount), 0);
  if (totalPaid > 0) {
    throw invoiceVoidError('Cannot void invoice with payments. Process refund instead.', 400);
  }

  const voidDate = new Date();
  const reversalReason = reason.trim();
  await assertPeriodOpen(user.tenantId, voidDate);

  const canAdminVoid =
    isFullAccessTenantRole(user) ||
    hasPermission(user, 'invoices.delete') ||
    hasPermission(user, 'invoices.void');

  // V2 reverse first (own posting boundary), then mark invoice void.
  const v2Reversal = await reverseSourceJournals({
    tenantId: user.tenantId,
    userId: user.id,
    reason: reversalReason,
    sourceTypes: ['Invoice', 'Invoice-COGS'],
    sourceIds: [invoiceId],
    requireJournals: true,
    postingDate: voidDate.toISOString().slice(0, 10),
    approvalOverride: canAdminVoid
      ? {
          approvedById: user.id,
          approvedAt: voidDate.toISOString(),
          createdById: null,
          allowSelfApproval: true,
        }
      : null,
  });

  return prisma.$transaction((tx) =>
    voidInvoiceInTransaction({
      tx,
      invoice,
      tenantId: user.tenantId,
      userId: user.id,
      reason: reversalReason,
      voidDate,
      v2Reversal,
      ipAddress,
      userEmail: user.email,
    })
  );
}
