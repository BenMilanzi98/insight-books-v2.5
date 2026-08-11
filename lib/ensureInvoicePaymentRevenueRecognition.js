import { postInvoiceRevenueRecognitionAccounting } from '@/lib/accountingV2/adapters';
import {
  computeFinalPaymentRecognizedNet,
  computePaymentRecognizedNet,
} from '@/lib/invoiceDeferredRevenue';
import { addMoney, MONEY_TOLERANCE, parseMoney, subtractMoney } from '@/lib/money';

const POSTED_STATUSES = ['Posted', 'POSTED', 'posted'];

function isCreditLine(line) {
  return parseMoney(line?.creditAmount) > 0;
}

function extractRecognizedNet(journal) {
  return parseMoney(journal?.metadata?.recognizedNet ?? journal?.totalCredit ?? journal?.totalDebit ?? 0);
}

/**
 * Posts payment-time invoice revenue recognition against deferred revenue.
 *
 * Skips:
 * - invoices without the issue journal posted yet
 * - legacy invoices that already credited sales revenue on issue
 * - payments already recognized via Invoice-Revenue journal
 */
export async function ensureInvoicePaymentRevenueRecognition({
  db,
  tenantId,
  userId,
  invoiceId,
  paymentId,
  paymentAmount,
  paymentDate,
  hasPermission = () => true,
}) {
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    select: {
      id: true,
      total: true,
      taxAmount: true,
      payments: {
        where: { status: 'Completed', isReversal: false },
        select: { id: true, amount: true },
      },
    },
  });

  if (!invoice) {
    throw new Error('Invoice not found for payment revenue recognition');
  }

  const issueJournal = await db.journalEntry.findFirst({
    where: {
      tenantId,
      sourceType: 'Invoice',
      sourceId: invoice.id,
      status: { in: POSTED_STATUSES },
    },
    include: {
      lines: {
        include: {
          account: {
            select: {
              id: true,
              accountCode: true,
              accountSubtype: true,
            },
          },
        },
      },
    },
  });

  if (!issueJournal) {
    return { skipped: 'no_issue_journal' };
  }

  const creditedAccountIds = (issueJournal.lines || [])
    .filter(isCreditLine)
    .map((line) => line.accountId)
    .filter(Boolean);

  const revenueMappings = creditedAccountIds.length && db.coaV2AccountMapping?.findMany
    ? await db.coaV2AccountMapping.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          purpose: 'SALES_REVENUE',
          accountId: { in: creditedAccountIds },
        },
        select: { accountId: true },
      })
    : [];
  const revenueAccountIds = new Set((revenueMappings || []).map((row) => row.accountId));

  const hasLegacyRevenueCredit = (issueJournal.lines || []).some((line) => {
    if (!isCreditLine(line)) return false;
    return (
      line.account?.accountCode === '4100'
      || line.account?.accountSubtype === 'SALES_REVENUE'
      || revenueAccountIds.has(line.accountId)
    );
  });

  if (hasLegacyRevenueCredit) {
    return { skipped: 'legacy_accrual' };
  }

  const existingRecognition = await db.journalEntry.findFirst({
    where: {
      tenantId,
      sourceType: 'Invoice-Revenue',
      sourceId: paymentId,
      status: { in: POSTED_STATUSES },
    },
    select: { id: true },
  });

  if (existingRecognition) {
    return { skipped: 'already_posted' };
  }

  const priorPayments = (invoice.payments || []).filter((payment) => payment.id !== paymentId);
  const priorPaymentIds = priorPayments.map((payment) => payment.id);
  const priorRecognitionJournals = priorPaymentIds.length
    ? await db.journalEntry.findMany({
        where: {
          tenantId,
          sourceType: 'Invoice-Revenue',
          sourceId: { in: priorPaymentIds },
          status: { in: POSTED_STATUSES },
        },
        select: {
          metadata: true,
          totalCredit: true,
          totalDebit: true,
        },
      })
    : [];

  const previouslyRecognizedNet = (priorRecognitionJournals || []).reduce(
    (sum, journal) => addMoney(sum, extractRecognizedNet(journal)),
    0
  );

  const invoiceTotal = parseMoney(invoice.total);
  const invoiceTaxAmount = parseMoney(invoice.taxAmount);
  const invoiceNet = subtractMoney(invoiceTotal, invoiceTaxAmount);
  const priorPaid = priorPayments.reduce((sum, payment) => addMoney(sum, payment.amount), 0);
  const remainingAfterThisPayment = subtractMoney(invoiceTotal, addMoney(priorPaid, paymentAmount));

  const recognizedNet = remainingAfterThisPayment <= MONEY_TOLERANCE
    ? computeFinalPaymentRecognizedNet({
        invoiceNet,
        previouslyRecognizedNet,
      })
    : computePaymentRecognizedNet({
        paymentAmount,
        invoiceTotal,
        invoiceTaxAmount,
      });

  const postingResult = await postInvoiceRevenueRecognitionAccounting({
    db,
    tenantId,
    userId,
    invoiceId,
    paymentId,
    recognizedNet,
    paymentDate,
    hasPermission,
  });

  return {
    recognizedNet,
    ...postingResult,
  };
}
