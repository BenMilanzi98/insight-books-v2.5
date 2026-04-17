/**
 * Builds rows for the "reversed taxes" report from posted GL transactions:
 * - sourceType Tax-Reversal (standalone tax postings from autoPostTaxEntry), and
 * - Tax lines inside compound Expense reversal journals (typical expense flow posts
 *   tax on the same Expense transaction, so there is no separate Tax-Expense row).
 * - PAYE embedded in Payroll journals (no separate Tax-Payroll row): reversal journals
 *   that target sourceType Payroll, matching original lines by PAYE / liability account.
 * - Tax-InvoiceVoid / Tax-InvoiceRefund (reverseAutoPostTaxEntry for voided or refunded invoices).
 */

/**
 * Invoice void/refund tax reductions posted as Tax-InvoiceVoid / Tax-InvoiceRefund (not Tax-Reversal).
 * @param {{ startDate?: string | null, endDate?: string | null }} range
 */
export async function fetchInvoiceLinkedTaxReversalRows(prisma, tenantId, range = {}) {
  const dateClause = transactionDateFilter(range.startDate || null, range.endDate || null);

  const txns = await prisma.transaction.findMany({
    where: {
      tenantId,
      status: 'posted',
      sourceType: { in: ['Tax-InvoiceVoid', 'Tax-Invoice-Void', 'Tax-InvoiceRefund'] },
      ...dateClause,
    },
    include: {
      lines: {
        orderBy: { lineNumber: 'asc' },
        include: { account: { select: { id: true, accountCode: true, accountName: true } } },
      },
    },
    orderBy: { date: 'desc' },
  });

  if (txns.length === 0) return [];

  const invoiceIds = [...new Set(txns.map((t) => t.sourceId).filter(Boolean))];
  const invoices =
    invoiceIds.length > 0
      ? await prisma.invoice.findMany({
          where: { id: { in: invoiceIds }, tenantId },
          select: { id: true, invoiceNumber: true, voidReason: true },
        })
      : [];
  const invById = Object.fromEntries(invoices.map((i) => [i.id, i]));

  const invoiceIdsWithCompoundVoid = new Set(
    txns.filter((t) => t.sourceType === 'Tax-Invoice-Void').map((t) => t.sourceId).filter(Boolean)
  );

  const filtered = txns.filter(
    (t) =>
      !(
        t.sourceType === 'Tax-InvoiceVoid' &&
        t.sourceId &&
        invoiceIdsWithCompoundVoid.has(t.sourceId)
      )
  );

  return filtered.map((rev) => {
    const inv = rev.sourceId ? invById[rev.sourceId] : null;
    let taxReversed = 0;
    for (const line of rev.lines || []) {
      const debit = Number(line.debitAmount || 0);
      const credit = Number(line.creditAmount || 0);
      taxReversed += Math.max(debit, credit);
    }
    const isVoid = rev.sourceType === 'Tax-InvoiceVoid' || rev.sourceType === 'Tax-Invoice-Void';
    return {
      id: `inv-tax-gl-${rev.id}`,
      date: rev.date,
      reference: inv ? `Invoice #${inv.invoiceNumber}` : `Invoice · ${rev.sourceId || rev.reference || ''}`,
      type:
        rev.sourceType === 'Tax-InvoiceRefund'
          ? 'Invoice refund (tax reversed)'
          : 'Invoice void (tax reversed)',
      taxReversed,
      reason: (inv && inv.voidReason) || rev.description || rev.reference || '',
      transactionId: rev.id,
      sourceExpenseId: null,
      originalTaxTransactionId: null,
    };
  });
}

function transactionDateFilter(startDate, endDate) {
  if (!startDate && !endDate) return {};
  const range = {};
  if (startDate) {
    const s = new Date(startDate);
    s.setHours(0, 0, 0, 0);
    range.gte = s;
  }
  if (endDate) {
    const e = new Date(endDate);
    e.setHours(23, 59, 59, 999);
    range.lte = e;
  }
  return Object.keys(range).length ? { date: range } : {};
}

/**
 * Compound expense JEs use the same line numbers on reversal as on the original post.
 * Pair by lineNumber and treat lines whose *original* description matches "Tax on expense"
 * as reversed input tax (works without TaxType.accountId and avoids false positives from
 * any line that merely contains "REVERSAL:").
 * One report row per reversal journal (sums multiple tax lines if ever present).
 */
async function fetchEmbeddedExpenseTaxReversalRows(prisma, tenantId, range = {}) {
  const { startDate, endDate } = range;
  const dateClause = transactionDateFilter(startDate || null, endDate || null);

  const reversals = await prisma.transaction.findMany({
    where: {
      tenantId,
      status: 'posted',
      isReversal: true,
      entryType: 'Reversal',
      sourceType: 'Expense',
      reversedTransactionId: { not: null },
      ...dateClause,
    },
    include: {
      lines: { orderBy: { lineNumber: 'asc' } },
    },
    orderBy: { date: 'desc' },
  });

  if (reversals.length === 0) return [];

  const origIds = [...new Set(reversals.map((r) => r.reversedTransactionId).filter(Boolean))];
  const originals = await prisma.transaction.findMany({
    where: {
      id: { in: origIds },
      tenantId,
      sourceType: 'Expense',
      isReversal: false,
    },
    include: {
      lines: { orderBy: { lineNumber: 'asc' } },
    },
  });
  const origById = Object.fromEntries(originals.map((o) => [o.id, o]));

  const taxOnExpense = /tax\s+on\s+expense/i;

  const byReversalTxnId = new Map();
  for (const rev of reversals) {
    const orig = origById[rev.reversedTransactionId];
    if (!orig) continue;

    const origLineByNum = Object.fromEntries(orig.lines.map((l) => [l.lineNumber, l]));

    for (const line of rev.lines) {
      const oLine = origLineByNum[line.lineNumber];
      if (!oLine || !taxOnExpense.test(oLine.description || '')) continue;

      const debit = Number(line.debitAmount || 0);
      const credit = Number(line.creditAmount || 0);
      const amt = Math.max(debit, credit);
      if (amt <= 0) continue;

      if (!byReversalTxnId.has(rev.id)) {
        byReversalTxnId.set(rev.id, {
          rev,
          sourceExpenseId: orig.sourceId || null,
          taxReversed: 0,
        });
      }
      byReversalTxnId.get(rev.id).taxReversed += amt;
    }
  }

  return Array.from(byReversalTxnId.values()).map(({ rev, sourceExpenseId, taxReversed }) => ({
    id: `gl-embedded-tax-rev-${rev.id}`,
    date: rev.date,
    reference: `Expense tax (compound JE) · ${rev.reference || rev.id}`,
    type: 'Expense deletion (tax in GL lines)',
    taxReversed,
    reason: rev.reversalReason || rev.notes || '',
    transactionId: rev.id,
    sourceExpenseId: sourceExpenseId || null,
    originalTaxTransactionId: null,
  }));
}

/**
 * PAYE is often posted only on the main Payroll journal (no separate Tax-Payroll transaction).
 * Those reversals use sourceType Transaction + reversedTransactionId → Payroll journal.
 * Pairs lines by lineNumber and sums reversal amounts for original lines that look like PAYE.
 *
 * @param {Set<string>} [skipPayrollIds] — Payroll record ids already covered by a Tax-Payroll → Tax-Reversal row
 */
async function fetchPayrollEmbeddedPayeReversalRows(
  prisma,
  tenantId,
  range = {},
  skipPayrollIds = new Set()
) {
  const { startDate, endDate } = range;
  const dateClause = transactionDateFilter(startDate || null, endDate || null);

  const reversals = await prisma.transaction.findMany({
    where: {
      tenantId,
      status: 'posted',
      isReversal: true,
      entryType: 'Reversal',
      reversedTransactionId: { not: null },
      ...dateClause,
    },
    include: {
      lines: { orderBy: { lineNumber: 'asc' }, include: { account: true } },
    },
    orderBy: { date: 'desc' },
  });

  if (reversals.length === 0) return [];

  const origIds = [...new Set(reversals.map((r) => r.reversedTransactionId).filter(Boolean))];
  const payrollOriginals = await prisma.transaction.findMany({
    where: {
      id: { in: origIds },
      tenantId,
      sourceType: 'Payroll',
      isReversal: false,
    },
    include: {
      lines: { orderBy: { lineNumber: 'asc' }, include: { account: true } },
    },
  });
  const payrollOrigById = Object.fromEntries(payrollOriginals.map((o) => [o.id, o]));

  const payeHint = /paye|pay\s*as\s*you\s*earn/i;

  const rows = [];
  for (const rev of reversals) {
    const orig = payrollOrigById[rev.reversedTransactionId];
    if (!orig) continue;
    if (orig.sourceId && skipPayrollIds.has(orig.sourceId)) continue;

    const origLineByNum = Object.fromEntries(orig.lines.map((l) => [l.lineNumber, l]));
    let taxReversed = 0;
    for (const line of rev.lines) {
      const oLine = origLineByNum[line.lineNumber];
      if (!oLine) continue;
      const od = oLine.description || '';
      const an = (oLine.account?.accountName || '').toLowerCase();
      const code = String(oLine.account?.accountCode || oLine.account?.code || '').toLowerCase();
      if (!payeHint.test(od) && !an.includes('paye') && !code.includes('paye')) continue;
      const debit = Number(line.debitAmount || 0);
      const credit = Number(line.creditAmount || 0);
      const amt = Math.max(debit, credit);
      if (amt <= 0) continue;
      taxReversed += amt;
    }
    if (taxReversed > 0) {
      rows.push({
        id: `payroll-paye-rev-${rev.id}`,
        date: rev.date,
        reference: `PAYE (payroll reversal) · ${orig.reference || rev.reference || rev.id}`,
        type: 'Payroll PAYE reversal (GL)',
        taxReversed,
        reason: rev.reversalReason || rev.notes || '',
        transactionId: rev.id,
        sourceExpenseId: null,
        originalTaxTransactionId: orig.id,
      });
    }
  }
  return rows;
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {{ startDate?: string | null, endDate?: string | null }} range
 * @returns {Promise<Array<{
 *   id: string,
 *   date: Date,
 *   reference: string,
 *   type: string,
 *   taxReversed: number,
 *   reason: string,
 *   transactionId: string,
 *   sourceExpenseId: string | null,
 *   originalTaxTransactionId: string | null
 * }>>}
 */
export async function fetchGlTaxReversalReportRows(prisma, tenantId, range = {}) {
  const { startDate, endDate } = range;
  const reversals = await prisma.transaction.findMany({
    where: {
      tenantId,
      status: 'posted',
      sourceType: 'Tax-Reversal',
      isReversal: true,
      ...transactionDateFilter(startDate || null, endDate || null),
    },
    include: {
      lines: true,
    },
    orderBy: { date: 'desc' },
  });

  const origIds = [
    ...new Set(reversals.map((r) => r.reversedTransactionId).filter(Boolean)),
  ];
  const originals =
    origIds.length > 0
      ? await prisma.transaction.findMany({
          where: { id: { in: origIds }, tenantId },
          select: {
            id: true,
            sourceType: true,
            sourceId: true,
            description: true,
            reference: true,
          },
        })
      : [];
  const origMap = Object.fromEntries(originals.map((o) => [o.id, o]));

  const payrollIdsWithStandaloneTaxReversal = new Set();
  for (const o of originals) {
    if (o.sourceType === 'Tax-Payroll' && o.sourceId) {
      payrollIdsWithStandaloneTaxReversal.add(o.sourceId);
    }
  }

  const standaloneRows = reversals.map((rev) => {
    const orig = rev.reversedTransactionId ? origMap[rev.reversedTransactionId] : null;
    const line = rev.lines?.[0];
    const taxReversed = line
      ? Math.max(Number(line.debitAmount || 0), Number(line.creditAmount || 0))
      : 0;

    let type = 'GL tax reversal';
    let reference = rev.reference || rev.description?.slice(0, 80) || rev.id;
    let sourceExpenseId = null;

    if (orig?.sourceType === 'Tax-Expense') {
      type = 'Expense deletion (tax reversal)';
      sourceExpenseId = orig.sourceId || null;
      reference = `Expense tax · ${rev.reference || rev.id}`;
    } else if (orig?.sourceType === 'Tax-Invoice') {
      type = 'Invoice tax reversal (GL)';
      reference = `Invoice tax · ${rev.reference || rev.id}`;
    } else if (orig?.sourceType === 'Tax-Sale') {
      type = 'Sale tax reversal (GL)';
      reference = `Sale tax · ${rev.reference || rev.id}`;
    } else if (orig?.sourceType === 'Tax-Payroll') {
      type = 'Payroll tax reversal (GL)';
      reference = `PAYE / payroll tax · ${rev.reference || rev.id}`;
    }

    return {
      id: `gl-tax-rev-${rev.id}`,
      date: rev.date,
      reference,
      type,
      taxReversed,
      reason: rev.reversalReason || rev.notes || '',
      transactionId: rev.id,
      sourceExpenseId,
      originalTaxTransactionId: orig?.id || null,
    };
  });

  const embeddedRows = await fetchEmbeddedExpenseTaxReversalRows(prisma, tenantId, range);
  const payrollPayeRows = await fetchPayrollEmbeddedPayeReversalRows(
    prisma,
    tenantId,
    range,
    payrollIdsWithStandaloneTaxReversal
  );

  const invoiceLinkedRows = await fetchInvoiceLinkedTaxReversalRows(prisma, tenantId, range);

  return [...standaloneRows, ...embeddedRows, ...payrollPayeRows, ...invoiceLinkedRows].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );
}
