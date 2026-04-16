export function formatJournalEntry(entry) {
  if (!entry) return null;

  const totals = (entry.lines || []).reduce(
    (acc, line) => {
      acc.debits += line.debitAmount ?? 0;
      acc.credits += line.creditAmount ?? 0;
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
    lines: (entry.lines || []).map((line) => ({
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
      debit: line.debitAmount ?? 0,
      credit: line.creditAmount ?? 0,
      debitAmount: line.debitAmount ?? 0,
      creditAmount: line.creditAmount ?? 0,
    })),
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

