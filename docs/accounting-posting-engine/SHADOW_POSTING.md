# Shadow Posting

Implementation: `lib/accountingV2/engine/postingEngine.js`
(`executeShadowPosting`) on the Phase 2 shadow infrastructure
(`lib/accountingV2/shadow/shadowAccounting.js`, `AcctV2ShadowJournal`,
`AcctV2ShadowJournalLine`, `AcctV2ShadowComparison`).

## Behaviour

In `SHADOW` / `DUAL_COMPARE` mode the engine runs the **identical** validation
pipeline and template logic as production, then:

1. Persists the proposed journal to the isolated shadow tables only.
2. Loads the legacy posting for the same source and compares.
3. Stores an `AcctV2ShadowComparison` row with the classification.
4. Marks the event `SHADOWED` (or `FAILED` for an invalid proposal — recorded,
   not thrown to the caller).

## Isolation guarantees

A shadow posting never: updates source posting status to production `POSTED`;
writes `JournalEntry`/`JournalEntryLine`; consumes a journal number; enters
the General Ledger, Trial Balance, receivables/payables controls, financial
statements or tax reports; or alters account balances. Tests assert
`legacyJournalEntries` and `journalSequences` stay empty and the invoice
status is untouched after a shadow run. The boundary tests additionally
forbid any production module or legacy report service from querying
`acctV2ShadowJournal*` tables.

## Comparison

Compared dimensions: source identity, debit/credit totals, account lines, tax
lines, dimensions, period, currency, description, journal count.

Classifications (all implemented): `EXACT_MATCH`, `ACCOUNT_DIFFERENCE`,
`AMOUNT_DIFFERENCE`, `LINE_COUNT_DIFFERENCE`, `TAX_DIFFERENCE`,
`DIMENSION_DIFFERENCE`, `PERIOD_DIFFERENCE`, `MISSING_LEGACY_POSTING`,
`DUPLICATE_LEGACY_POSTING`, `INVALID_LEGACY_POSTING`, `INVALID_NEW_PROPOSAL`,
`REQUIRES_REVIEW`.

Pilot: the `CUSTOMER_INVOICE` template runs shadow-only in Phase 4. Tests
cover exact match, amount difference, missing legacy posting and invalid
proposal recording. The diagnostics page and
`/api/accounting-v2/posting-engine` expose the exact-match rate used as a
rollout acceptance threshold.
