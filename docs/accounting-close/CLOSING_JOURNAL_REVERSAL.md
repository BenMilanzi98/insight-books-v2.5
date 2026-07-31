# Closing Journal Reversal

Service: `closingReversalService.js` → `reverseJournal` (Posting Engine `REVERSAL_POSTED`).

Rules:

- Never delete or edit the original Closing Journal.
- Mark batch `REVERSED` with reversal journal linkage in metadata.
- Callable via `POST .../runs/:id/reverse-closing` or optionally during year reopen execute (`reverseClosingJournals: true`).
- Re-close uses a **new** close version and new Closing Batch.
