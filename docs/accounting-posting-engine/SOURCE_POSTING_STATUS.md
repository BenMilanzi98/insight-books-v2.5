# Source Posting Status

Implementation: `lib/accountingV2/engine/sourcePostingState.js`.

## Design decision: central link, not per-table columns

Rather than adding accounting-status columns to every operational table, the
**event registry is the central source-accounting link**. A source's
accounting state is derived from its `AcctV2EventRegistry` rows via
`getSourcePostingState(db, context, { sourceType, sourceId })`, which returns:

```
{ state, accountingEventId, postedJournalId, postedAt, postedBy,
  architectureVersion, failureCode, failureMessage, attemptCount }
```

This matches the prompt's guidance to prefer a central source-link table over
scattering fields across source tables, and keeps legacy tables untouched
(additive-only rule).

## States

`SourcePostingState`: `NOT_READY`, `READY_TO_POST`, `POSTING`, `POSTED`,
`POSTING_FAILED`, `REVERSED`, `CANCELLED_BEFORE_POSTING`, `SHADOWED`,
`NOT_TRACKED` (no V2 event exists — legacy-only source).

Derivation: the primary (highest event-version, non-superseded) event's
registry status maps onto the state; reversal events flip a `POSTED` source to
`REVERSED`.

## Explicitness

Accounting status is never inferred from business status (`PAID`, `APPROVED`,
…). The engine's source validators check business status for *postability*,
but the accounting state itself always comes from the registry.

Where a Phase 4 source has its own lifecycle table, the posting transaction
also updates it: `AcctV2OpeningBalanceBatch.status → POSTED` plus
`journalEntryId` linkage happen inside the same transaction as the journal
write (rolled back together on failure).

Outbox event `SOURCE_ACCOUNTING_STATUS_CHANGED` is emitted on every state
change so downstream consumers can react after commit.
