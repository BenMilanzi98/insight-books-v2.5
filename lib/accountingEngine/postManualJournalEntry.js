/**
 * Manual journal entry posting — re-exports from journalService for now.
 *
 * Manual journals MUST keep `transactionId: null` on JournalEntry rows. System modules
 * that mirror Transaction postings into JournalEntry set transactionId to link the mirror;
 * manual entries created via createDraftEntry / postEntry / createReversalEntry never
 * assign transactionId on create. Querying manual journals with manualJournalEntryWhere
 * (transactionId: null) avoids double-counting GL when a Transaction and its mirror
 * both exist for the same economic event.
 */

export {
  createDraftEntry,
  postEntry,
  createReversalEntry,
} from '../journalService.js';
