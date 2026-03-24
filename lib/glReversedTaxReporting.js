/**
 * Builds rows for the "reversed taxes" report from posted GL transactions:
 * - sourceType Tax-Reversal (standalone tax postings from autoPostTaxEntry), and
 * - Tax lines inside compound Expense reversal journals (typical expense flow posts
 *   tax on the same Expense transaction, so there is no separate Tax-Expense row).
 */

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

  return [...standaloneRows, ...embeddedRows].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );
}
