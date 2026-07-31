# Atomic Persistence

Implementation: `lib/accountingV2/engine/postingEngine.js`
(`executeNewEnginePosting`) + `journalPersistence.js`, using the Phase 2
transaction boundary (`infrastructure/transactionBoundary.js`).

## The posting transaction (Phase B)

Inside **one** database transaction:

1. Re-verify the claimed event has no active posting (and no active legacy
   posting — `assertNewEnginePostingAllowed`).
2. Resolve/confirm the accounting period (re-checked inside the transaction).
3. Allocate the journal number (`AcctV2JournalSequence` atomic increment).
4. Create/promote the `JournalEntry` with all V2 columns.
5. Create all `JournalEntryLine` rows (batched nested create).
6. Set journal status to `Posted` via the status machine.
7. Link the event registry row to the journal (`journalEntryId`,
   status → `POSTED`, `postedAt`).
8. Update the source posting state (e.g. opening-balance batch → `POSTED`).
9. Write the audit record (`infrastructure/auditTrail.js`).
10. Write transactional outbox events (`infrastructure/outbox.js`) —
    `JOURNAL_POSTED`, `SOURCE_ACCOUNTING_STATUS_CHANGED`, etc.
11. Commit.

No external network calls (email, gateways, webhooks) occur inside the
transaction — see `TRANSACTIONAL_OUTBOX.md`.

## Failure behaviour

Any failure rolls back **everything** in Phase B: journal, lines, source
state, audit and outbox rows. After rollback, a sanitized failure is recorded
through the safe path: the Phase A event row is transitioned to `FAILED` with
`failureCode`/`failureMessage`/`failureRetryable`, and an
`AcctV2PostingAttempt` row records the attempt. This guarantees:

- No journal without lines / lines without journal.
- No source marked posted without a journal, or vice versa.
- No event linked to a missing journal.
- No audit record claiming success after rollback.

Verified by the transaction-rollback tests ("failed posting leaves no partial
effect and records a durable failure") — a closed period discovered inside the
transaction leaves the draft journal untouched, consumes no journal number,
and produces a durable `FAILED` event + `FAILED_FATAL` attempt.

## Database backstops

`je_v2_posted_requirements` CHECK constraint: a V2 posted journal must carry a
posting date, period, source linkage, template and event linkage. Non-negative
CHECK constraints on line debit/credit amounts.
