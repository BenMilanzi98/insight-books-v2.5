# Shadow Accounting

Implementation: `lib/accountingV2/shadow/shadowAccounting.js` + `AcctV2Shadow*` tables.

## Isolation guarantees

- Shadow journals/lines/comparisons live in dedicated tables that no production report,
  ledger query, balance calculation, or dashboard touches. Boundary tests assert no module
  outside the V2 kernel (and the read-only audit engine) references shadow tables.
- A shadow run writes nothing to `Transaction`, `JournalEntry`, `Account.balance`,
  `AccountBalance`, or any operational table (proved by test: legacy row counts unchanged
  and `journalId: null` in the result).
- Rows carry `architectureVersion: TRANSITION_V2` and status `PROPOSED` — never `posted`.

## Flow (mode = SHADOW or DUAL_COMPARE)

1. Event registered in `AcctV2EventRegistry` (identity + idempotency as for real postings).
2. Proposed `JournalDraft` persisted to `AcctV2ShadowJournal(+Lines)`.
3. Legacy postings for the same source read via the posting adapter.
4. `compareProposalWithLegacy` produces per-account minor-unit differences.
5. `AcctV2ShadowComparison` persisted with status, severity, differences JSON, explanation.
6. Registry status → `SHADOWED`. All inside one transaction.

## Comparison statuses (implemented)

`EXACT_MATCH`, `ACCOUNT_DIFFERENCE`, `AMOUNT_DIFFERENCE`, `MISSING_LEGACY_POSTING`,
`MISSING_NEW_PROPOSAL`, `DUPLICATE_LEGACY_POSTING`, `PERIOD_DIFFERENCE`,
`DIMENSION_DIFFERENCE`, `UNBALANCED_LEGACY`, `INVALID_NEW_PROPOSAL`, `REQUIRES_REVIEW`.
Phase 2 comparison logic emits the first six plus `UNBALANCED_LEGACY`; period/dimension
comparisons activate in Phase 4 when drafts carry resolved periods, and `INVALID_NEW_PROPOSAL`
is prevented upstream by draft validation (invalid drafts never reach the store) — statuses
are reserved and queryable now.

## Demonstration event

The test suite exercises a synthetic `INVOICE_POSTED` shadow run end-to-end against a seeded
legacy posting (exact match, account difference, amount difference, duplicate legacy,
missing legacy, unbalanced legacy). No production tenant has shadow mode on: activation
requires `AcctV2Configuration.enableShadowAccounting` + the `accountingV2ShadowMode` flag,
both server-side, plus performance review per `ACCOUNTING_CUTOVER_STRATEGY.md`.

## Review surface

`/system/accounting-architecture` shows comparison counts by status, last run, and
outstanding critical/high findings. The `architecture` audit module raises ARCH-003 for
unreviewed critical/high comparisons and ARCH-007 for shadow journals missing comparisons.
