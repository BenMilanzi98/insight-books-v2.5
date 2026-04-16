/**
 * Unified activity for a payment account: payments, POS deposits,
 * posted journal lines on the linked CoA account, and legacy flat journal rows.
 */
import prisma from '@/lib/prisma';

function paymentWhereClause(tenantId, accountId, accountName) {
  return {
    tenantId,
    isReversal: false,
    OR: [
      { paymentMethod: accountId },
      { paymentMethod: { equals: accountName, mode: 'insensitive' } },
      { sourceAccount: accountId },
      { destinationAccount: accountId },
      { sourceAccount: { equals: accountName, mode: 'insensitive' } },
      { destinationAccount: { equals: accountName, mode: 'insensitive' } },
      {
        allocations: {
          some: { paymentAccountId: accountId },
        },
      },
    ],
  };
}

function formatPaymentRow(payment, accountId, accountName) {
  const alloc = (payment.allocations || []).find((a) => a.paymentAccountId === accountId);
  const allocAmount = alloc ? Number(alloc.amount || 0) : null;
  const parts = [];
  if (payment.invoice?.invoiceNumber) parts.push(`Invoice ${payment.invoice.invoiceNumber}`);
  if (payment.sale?.saleNumber) parts.push(`Sale ${payment.sale.saleNumber}`);
  if (payment.type === 'transfer') parts.push('Transfer');
  if (payment.expenseId) parts.push('Expense');
  const summary = parts.length ? parts.join(' · ') : accountName ? `Activity — ${accountName}` : 'Payment';
  return {
    id: `payment:${payment.id}`,
    source: 'payment',
    eventCategory: 'Payment',
    paymentDate: payment.paymentDate,
    type: payment.type || payment.paymentMethod || 'payment',
    amount: Number(payment.amount || 0),
    allocationAmount: allocAmount,
    status: payment.status,
    reference: payment.reference || '',
    notes: payment.notes || '',
    paymentMethod: payment.paymentMethod,
    sourceAccount: payment.sourceAccount,
    destinationAccount: payment.destinationAccount,
    clientName: payment.invoice?.client?.name || null,
    invoiceNumber: payment.invoice?.invoiceNumber || null,
    saleNumber: payment.sale?.saleNumber || null,
    summary,
  };
}

function posDepositDate(businessDate) {
  if (!businessDate || typeof businessDate !== 'string') return new Date();
  const d = new Date(`${businessDate}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function journalLineSummary(line, entry) {
  const ref = entry.referenceNumber || '';
  const base = line.description || entry.description || 'Journal line';
  const st = entry.sourceType ? ` · ${entry.sourceType}` : '';
  return ref ? `${base}${st} · ${ref}` : `${base}${st}`;
}

/**
 * @param {string} tenantId
 * @param {string} paymentAccountId
 * @returns {Promise<{ account: object, transactions: object[] } | null>}
 */
export async function fetchPaymentAccountActivity(tenantId, paymentAccountId) {
  const account = await prisma.paymentAccount.findFirst({
    where: { id: paymentAccountId, tenantId, isActive: true },
    select: { id: true, name: true, accountType: true, coaAccountId: true },
  });

  if (!account) return null;

  const name = account.name || '';
  const coaId = account.coaAccountId;

  const [payments, posDeposits, journalLines, legacyJournalEntries] = await Promise.all([
    prisma.payment.findMany({
      where: paymentWhereClause(tenantId, account.id, name),
      orderBy: { paymentDate: 'desc' },
      take: 400,
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            client: { select: { name: true } },
          },
        },
        sale: { select: { saleNumber: true } },
        allocations: {
          include: {
            paymentAccount: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.posCashDayDeposit.findMany({
      where: {
        toAccountId: account.id,
        posCashDay: { tenantId },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        posCashDay: {
          select: { businessDate: true, id: true, status: true, systemCashAccountId: true },
        },
      },
    }),
    coaId
      ? prisma.journalEntryLine.findMany({
          where: {
            accountId: coaId,
            journalEntry: {
              tenantId,
              status: 'Posted',
            },
          },
          include: {
            journalEntry: {
              select: {
                id: true,
                entryDate: true,
                createdAt: true,
                referenceNumber: true,
                description: true,
                sourceType: true,
                entryType: true,
                notes: true,
                status: true,
              },
            },
          },
          take: 400,
        })
      : Promise.resolve([]),
    coaId
      ? prisma.journalEntry.findMany({
          where: {
            tenantId,
            status: 'Posted',
            accountId: coaId,
            lines: { none: {} },
          },
          orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
          take: 200,
        })
      : Promise.resolve([]),
  ]);

  const rows = [];

  for (const p of payments) {
    rows.push(formatPaymentRow(p, account.id, name));
  }

  for (const d of posDeposits) {
    const bd = d.posCashDay?.businessDate;
    rows.push({
      id: `pos_deposit:${d.id}`,
      source: 'pos_deposit',
      eventCategory: 'POS deposit',
      paymentDate: posDepositDate(bd),
      type: d.isAutoSweep ? 'pos_auto_sweep' : 'pos_deposit',
      amount: Number(d.amount || 0),
      allocationAmount: null,
      status: 'Completed',
      reference: d.posCashDayId || '',
      notes: d.notes || (d.isAutoSweep ? 'Auto sweep at day close' : ''),
      paymentMethod: null,
      sourceAccount: d.posCashDay?.systemCashAccountId || null,
      destinationAccount: account.id,
      clientName: null,
      invoiceNumber: null,
      saleNumber: null,
      summary: `POS cash deposit${bd ? ` · day ${bd}` : ''}${d.notes ? ` · ${d.notes}` : ''}`,
    });
  }

  for (const line of journalLines) {
    const entry = line.journalEntry;
    if (!entry) continue;
    const debit = Number(line.debitAmount || 0);
    const credit = Number(line.creditAmount || 0);
    const net = debit - credit;
    rows.push({
      id: `journal_line:${line.id}`,
      source: 'journal',
      eventCategory: entry.sourceType || 'Journal entry',
      paymentDate: entry.entryDate || entry.createdAt,
      type: 'journal_line',
      amount: Math.abs(net),
      journalDebit: debit,
      journalCredit: credit,
      journalNet: net,
      allocationAmount: null,
      status: entry.status || 'Posted',
      reference: entry.referenceNumber || '',
      notes: entry.notes || line.description || '',
      paymentMethod: null,
      sourceAccount: null,
      destinationAccount: null,
      clientName: null,
      invoiceNumber: null,
      saleNumber: null,
      summary: journalLineSummary(line, entry),
    });
  }

  for (const je of legacyJournalEntries) {
    const debit = Number(je.debit || 0);
    const credit = Number(je.credit || 0);
    const net = debit - credit;
    rows.push({
      id: `journal_legacy:${je.id}`,
      source: 'journal',
      eventCategory: je.sourceType || 'Journal (legacy)',
      paymentDate: je.entryDate || je.createdAt,
      type: 'journal_legacy',
      amount: Math.abs(net),
      journalDebit: debit,
      journalCredit: credit,
      journalNet: net,
      allocationAmount: null,
      status: je.status || 'Posted',
      reference: je.referenceNumber || '',
      notes: je.notes || je.description || '',
      paymentMethod: null,
      sourceAccount: null,
      destinationAccount: null,
      clientName: null,
      invoiceNumber: null,
      saleNumber: null,
      summary: je.description || je.sourceType || 'Ledger posting',
    });
  }

  rows.sort((a, b) => {
    const ta = new Date(a.paymentDate).getTime();
    const tb = new Date(b.paymentDate).getTime();
    return tb - ta;
  });

  return { account, transactions: rows.slice(0, 500) };
}
