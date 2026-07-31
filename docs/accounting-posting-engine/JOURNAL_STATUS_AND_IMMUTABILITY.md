# Journal Status Lifecycle and Immutability

Implementation: `lib/accountingV2/domain/journalStatus.js` (status machine +
mutation guard) and `lib/accountingV2/engine/journalPersistence.js`
(enforcement at the persistence boundary).

## Statuses

V2 domain statuses: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `POSTING`,
`POSTED`, `REVERSED`, `FAILED`, `REJECTED`, `CANCELLED`.

They persist as legacy-compatible strings (`Draft`, `PendingApproval`,
`Approved`, `Posted`, …) via `PERSISTED_JOURNAL_STATUS`, so V2 posted journals
remain visible to existing reports while the richer V2 lifecycle is enforced
by `assertJournalStatusTransition`.

## Permitted transitions

```
DRAFT → PENDING_APPROVAL → APPROVED → POSTING → POSTED
DRAFT → CANCELLED
PENDING_APPROVAL → REJECTED | CANCELLED
APPROVED → CANCELLED (before posting)
POSTING → POSTED | FAILED
POSTED → REVERSED (only via a new reversal accounting event)
```

Forbidden and server-side rejected: `POSTED → DRAFT`, `POSTED → CANCELLED`,
deleting posted journals, `REVERSED → POSTED`, and any client-supplied status
value (statuses are set only by services/engine).

## Immutability of posted journals

`assertJournalMutationAllowed(journalRow, patch)` runs on every V2 journal
update. For a posted journal it rejects changes to: journal/posting dates,
period, source linkage, currency, exchange rate, accounts, debit/credit
amounts, dimensions, tax fields, approval fields, description (where it
changes accounting meaning), architecture/template versions, totals.

Allowed: safe non-financial annotations (`notes`), which are audited.
Tested: "posted journals accept only note annotations — financial fields are
frozen" (`JournalImmutableError` on a `totalDebit` patch; `notes` patch
succeeds).

Legacy paths are also blocked: `lib/journalService.js` refuses `postEntry`,
`voidEntry` and `createReversalEntry` on journals with
`architectureVersion === 'ACCOUNTING_V2'`, directing corrections to the V2
reversal/adjustment workflow. Corrections use reversal, adjustment journals,
credit/debit notes or void-and-repost — never in-place edits.

Database backstop: the `je_v2_posted_requirements` CHECK constraint prevents a
V2 journal from being flagged posted without its mandatory financial fields.
