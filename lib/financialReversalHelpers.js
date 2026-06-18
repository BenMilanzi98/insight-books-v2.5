/**
 * Helpers to locate posted journals for payments and reverse accounting safely.
 * Invoice payments post via postGlEntry with sourceType InvoicePayment and
 * sourceId `{invoiceId}-payment-{referenceNumber}` (legacy rows may use invoiceId only).
 */

import prisma from '@/lib/prisma';
import { createTransactionReversal } from '@/lib/transactionReversalService';

function startOfLocalDay(d) {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(d) {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate(), 23, 59, 59, 999);
}

/**
 * @param {{ tenantId: string, invoiceId: string, paymentAmount: number, paymentDate: Date, paymentCreatedAt?: Date, paymentReference?: string|null }} p
 * @returns {Promise<string|null>} transaction id
 */
export async function findInvoicePaymentJournalTransactionId(p) {
  const { tenantId, invoiceId, paymentAmount, paymentDate, paymentCreatedAt, paymentReference } = p;
  const amt = Number(paymentAmount || 0);
  if (!tenantId || !invoiceId || !amt) return null;

  const idPrefix = `${invoiceId}-payment-`;
  const sourceIdClauses = [
    { sourceId: invoiceId },
    { sourceId: { startsWith: idPrefix } },
  ];
  if (paymentReference && String(paymentReference).trim()) {
    sourceIdClauses.push({ sourceId: { contains: String(paymentReference).trim() } });
  }

  const txs = await prisma.transaction.findMany({
    where: {
      tenantId,
      sourceType: 'InvoicePayment',
      status: 'posted',
      isReversal: false,
      OR: sourceIdClauses,
      date: {
        gte: startOfLocalDay(paymentDate),
        lte: endOfLocalDay(paymentDate),
      },
    },
    include: { lines: true },
    orderBy: { createdAt: 'asc' },
  });

  const candidates = txs.filter((tx) => {
    const debitLine = tx.lines?.find((l) => Number(l.debitAmount || 0) > 0);
    return debitLine && Math.abs(Number(debitLine.debitAmount) - amt) < 0.02;
  });

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].id;

  const ref = paymentCreatedAt ? new Date(paymentCreatedAt).getTime() : new Date(paymentDate).getTime();
  let best = candidates[0];
  let bestDiff = Math.abs(new Date(best.createdAt).getTime() - ref);
  for (const t of candidates.slice(1)) {
    const diff = Math.abs(new Date(t.createdAt).getTime() - ref);
    if (diff < bestDiff) {
      best = t;
      bestDiff = diff;
    }
  }
  return best.id;
}

/**
 * Reverse journal entries posted with sourceId = paymentId (expense/sale/transfer paths).
 */
export async function reverseJournalEntriesLinkedToPaymentId({
  tenantId,
  userId,
  paymentId,
  reversalReason,
}) {
  const txs = await prisma.transaction.findMany({
    where: {
      tenantId,
      sourceId: paymentId,
      status: 'posted',
      isReversal: false,
      sourceType: { in: ['Payment', 'ExpensePayment', 'SalePayment', 'Transfer'] },
    },
    select: { id: true },
  });

  const reversed = [];
  for (const tx of txs) {
    const already = await prisma.transaction.findFirst({
      where: {
        tenantId,
        isReversal: true,
        reversedTransactionId: tx.id,
      },
      select: { id: true },
    });
    if (already) continue;
    await createTransactionReversal({
      transactionId: tx.id,
      reversalReason,
      userId,
      tenantId,
    });
    reversed.push(tx.id);
  }
  return reversed;
}
