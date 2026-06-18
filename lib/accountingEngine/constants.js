/** Posted transaction header statuses (case variants in legacy data). */
export const POSTED_TRANSACTION_STATUSES = ['posted', 'Posted', 'POSTED'];

/** Posted manual journal header statuses. */
export const POSTED_JOURNAL_STATUSES = ['Posted', 'posted', 'POSTED'];

/**
 * Prisma `where` fragment for manual journal entries only (excludes mirrored system postings).
 * Mirrored journals link to a Transaction via `transactionId` and must not be read alongside
 * that transaction's lines — otherwise GL and period close double-count.
 */
export function manualJournalEntryWhere(extra = {}) {
  return {
    transactionId: null,
    status: { in: POSTED_JOURNAL_STATUSES },
    ...extra,
  };
}
