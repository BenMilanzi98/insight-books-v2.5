# Journal Numbering

Implementation: `lib/accountingV2/engine/journalNumbering.js`
(`allocateJournalNumber`) backed by the `AcctV2JournalSequence` table.

## Format

`{PREFIX}-{YEAR}-{NNNNNN}` — e.g. `MJ-2026-000001`, `ADJ-2026-000014`,
`OB-2026-000001`. Prefix comes from the template (manual journal `MJ`,
adjustment `ADJ`, opening balance `OB`; operational templates declare their
own prefixes for Phase 9). Year comes from the resolved posting date, making
sequences period-year aware.

## Mechanism

- `AcctV2JournalSequence` holds one row per `(tenantId, scopeKey)` where
  `scopeKey` is `{PREFIX}-{YEAR}` — unique constraint enforced.
- Allocation is an atomic `update … lastValue + 1` (upserting the row on first
  use) executed **inside the posting transaction**. The row-level lock
  serializes concurrent allocations for the same scope; different scopes and
  businesses never block each other.
- `lastValue` has a non-negative CHECK constraint.

## Properties

| Requirement | How met |
| --- | --- |
| Unique per business/scope | DB unique constraint on `(tenantId, scopeKey)` + `JournalEntry(tenantId, journalNumber)` unique constraint |
| Concurrency-safe | Atomic increment under row lock |
| Stable after generation | Number written to the journal in the same transaction; never regenerated |
| Rollback gaps | If the transaction rolls back the increment rolls back too; if a number is consumed and a later independent posting fails, gaps are permitted and auditable (sequence table shows lastValue) |
| Searchable / auditable | Indexed `journalNumber` column; sequence table is inspectable |
| Not row-count based | Never derived from counting existing journals |

Tests: journal-numbering suite in `test/accountingV2.postingEngine.test.js`
(sequential uniqueness, per-scope isolation, per-business isolation) and the
preview test asserting no number is consumed by previews.
