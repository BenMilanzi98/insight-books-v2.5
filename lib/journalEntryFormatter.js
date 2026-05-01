/**
 * Normalize amounts from DB / JSON (number, string, Prisma Decimal, etc.).
 */
export function coerceJournalAmount(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === 'object' && typeof value?.toNumber === 'function') {
    try {
      const n = value.toNumber();
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Prefer JournalEntryLine rows; many legacy/system flows store one-sided postings on the
 * JournalEntry header (accountId + debit/credit) with no lines — synthesize one row for UI/API.
 */
export function expandJournalEntryLines(entry) {
  const raw = Array.isArray(entry?.lines) ? entry.lines : [];
  if (raw.length > 0) return raw;

  const accountId = entry?.accountId;
  const debit = coerceJournalAmount(entry?.debit);
  const credit = coerceJournalAmount(entry?.credit);
  if (!accountId || (Math.abs(debit) < 1e-9 && Math.abs(credit) < 1e-9)) {
    return raw;
  }

  return [
    {
      id: `${entry.id}-legacy-header`,
      lineNumber: 1,
      accountId,
      debitAmount: debit,
      creditAmount: credit,
      description: entry.description ?? null,
      account: null,
    },
  ];
}

export function formatJournalEntry(entry) {
  if (!entry) return null;

  const linesForTotals = expandJournalEntryLines(entry);

  const totals = linesForTotals.reduce(
    (acc, line) => {
      acc.debits += coerceJournalAmount(line.debitAmount);
      acc.credits += coerceJournalAmount(line.creditAmount);
      return acc;
    },
    { debits: 0, credits: 0 }
  );

  return {
    id: entry.id,
    referenceNumber: entry.reference || entry.referenceNumber,
    entryDate: entry.date || entry.entryDate,
    date: entry.date || entry.entryDate,
    description: entry.description,
    entryType: entry.entryType,
    status: entry.status,
    notes: entry.notes,
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
    isReversal: entry.isReversal ?? false,
    reversedTransactionId: entry.reversedTransactionId ?? null,
    reversalReason: entry.reversalReason ?? null,
    totalDebit: totals.debits,
    totalCredit: totals.credits,
    amount: Math.max(totals.debits, totals.credits),
    createdBy: entry.createdBy
      ? {
          id: entry.createdBy.id,
          name: entry.createdBy.name,
          email: entry.createdBy.email,
        }
      : null,
    postedBy: entry.postedBy
      ? {
          id: entry.postedBy.id,
          name: entry.postedBy.name,
          email: entry.postedBy.email,
        }
      : null,
    lines: linesForTotals.map((line) => {
      const dr = coerceJournalAmount(line.debitAmount);
      const cr = coerceJournalAmount(line.creditAmount);
      return {
        id: line.id,
        lineNumber: line.lineNumber,
        accountId: line.accountId,
        accountCode:
          line.account?.accountCode ||
          line.account?.code ||
          null,
        accountName:
          line.account?.accountName ||
          line.account?.name ||
          null,
        accountType: line.account?.accountType || line.account?.type || null,
        description: line.description,
        debit: dr,
        credit: cr,
        debitAmount: dr,
        creditAmount: cr,
      };
    }),
  };
}

export function formatJournalEntries(entries) {
  return entries.map((entry) => formatJournalEntry(entry));
}

/**
 * Logical merges: keep posting account on each line; surface survivor code/name for display.
 * @param {Array<Record<string, unknown>>} entries formatted journal entries
 * @param {{ displayFieldsForPostingAccountId: (id: string) => Record<string, unknown>|null }} mergeCtx from buildMergeRollupContext
 */
export function applyMergeDisplayToJournalPayload(entries, mergeCtx) {
  if (!entries?.length || !mergeCtx?.displayFieldsForPostingAccountId) return entries || [];
  return entries.map((entry) => ({
    ...entry,
    lines: (entry.lines || []).map((line) => {
      const d = mergeCtx.displayFieldsForPostingAccountId(line.accountId);
      if (!d) return line;
      return {
        ...line,
        postingAccountId: line.accountId,
        postingAccountCode: line.accountCode,
        postingAccountName: line.accountName,
        displayAccountId: d.displayAccountId,
        accountCode: d.displayAccountCode ?? line.accountCode,
        accountName: d.displayAccountName ?? line.accountName,
      };
    }),
  }));
}

