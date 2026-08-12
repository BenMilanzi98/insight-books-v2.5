import { reverseSourceJournals } from '@/lib/accountingV2/application/reverseSourceJournals.js';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';

export async function voidInvoiceInTransaction({
  tx,
  invoice,
  tenantId,
  userId,
  reason,
  voidDate = new Date(),
  v2Reversal,
  ipAddress,
  userEmail,
}) {
  const updatedInvoice = await tx.invoice.update({
    where: { id: invoice.id },
    data: {
      status: 'void',
      voidedAt: voidDate,
      voidedById: userId,
      voidReason: reason,
      originalTotal: invoice.total,
      updatedAt: voidDate,
    },
  });

  await tx.auditLog.create({
    data: {
      action: 'INVOICE_VOID',
      entityType: 'INVOICE',
      entityId: invoice.id,
      userId,
      tenantId,
      details: JSON.stringify({
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.client?.name,
        originalTotal: invoice.total,
        voidReason: reason,
        voidedBy: userEmail,
        v2JournalsReversed: v2Reversal.reversed.map((entry) => entry.originalJournalId),
        v2JournalsSkipped: v2Reversal.skippedAlreadyReversed,
      }),
      ipAddress,
      timestamp: voidDate,
    },
  });

  return updatedInvoice;
}

export async function voidPostedInvoice({
  db,
  invoice,
  invoiceId = invoice?.id,
  tenantId,
  userId,
  reason,
  voidDate = new Date(),
  ipAddress,
  userEmail,
}) {
  await assertPeriodOpen(tenantId, voidDate, db);

  const v2Reversal = await reverseSourceJournals({
    tenantId,
    userId,
    reason,
    sourceTypes: ['Invoice', 'Invoice-COGS'],
    sourceIds: [invoiceId],
    requireJournals: true,
    postingDate: voidDate.toISOString().slice(0, 10),
    db,
  });

  return voidInvoiceInTransaction({
    tx: db,
    invoice: { ...invoice, id: invoiceId },
    tenantId,
    userId,
    reason,
    voidDate,
    v2Reversal,
    ipAddress,
    userEmail,
  });
}
