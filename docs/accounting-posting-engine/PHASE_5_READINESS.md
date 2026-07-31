# Phase 5 Readiness — General Ledger Reconstruction Inputs

Phase 5 must build the General Ledger entirely from posted journal lines. The
Phase 4 engine guarantees the following canonical structures and rules.

## Canonical Journal Entry (V2)

`JournalEntry` row with `architectureVersion = 'ACCOUNTING_V2'`:
`journalNumber` (unique per business), `status = 'Posted'`, `postingDate`,
`entryDate` (transaction date), `accountingPeriodId`, `financialYearLabel`,
`currency`, `exchangeRate`, `baseCurrency`, `totalDebit`, `totalCredit`,
`sourceType`/`sourceId` linkage, `templateId` + `templateVersion`,
`accountingEventId` (unique), `postingMode`, `createdById`, `approvedById`,
`approvedAt`, `adjustmentCategory`/`adjustmentReason` where applicable.

## Canonical Journal Entry Line

`JournalEntryLine`: `accountId`, `debitAmount`, `creditAmount` (Decimal(18,2),
non-negative, never both positive), `baseDebit`, `baseCredit`, `currency`,
`taxCode`, `dimensions` (JSON: customer/supplier/employee/owner/bank/loan/
asset/project/branch/department/cost centre), `description`, sequence.

## Posted-status definition

A journal participates in the ledger iff `status = 'Posted'`. For V2 rows
this is guaranteed by the status machine + `je_v2_posted_requirements`
constraint (posted ⇒ period, posting date, source, template, event linkage all
present).

## Required ledger filters

1. `status = 'Posted'`.
2. Exclude shadow data structurally: shadow proposals live only in
   `AcctV2ShadowJournal(Line)` — they can never appear in `JournalEntry`
   queries, so no filter is even needed, but Phase 5 must never join shadow
   tables into ledger queries (boundary-tested).
3. Reversals: a reversed journal stays `POSTED`-with-`REVERSED` event state;
   its reversal is a separate posted journal. Ledger sums include both (net
   zero), consistent with immutable double-entry history.
4. Opening balances: `entryType = 'OpeningBalance'` journals seed balances and
   must be included in balance computation from the effective date.

## Known heterogeneity Phase 5 must decide on

- **Two legacy stores**: historical postings exist in both
  `Transaction`/`TransactionLine` and `JournalEntry`/`JournalEntryLine`
  (Phase 1 finding). Phase 5 must either read both behind one adapter or
  migrate legacy `Transaction` data into the canonical store. The V2 columns
  are nullable on legacy rows — `architectureVersion IS NULL` identifies them.
- Legacy rows lack `journalNumber`, period linkage, `totalDebit/Credit` and
  base-currency amounts; Phase 5 must derive or backfill where needed.
- Multi-currency: V2 rows carry base amounts; legacy rows may not.

## Index inventory (already in place)

Business + status, posting date, period, journal number, source
(type, id), accounting event, account (line level) — supporting ledger
aggregation without full scans.

## Blockers for Phase 5

None from the engine itself. Open decisions: the dual legacy store treatment
above, and period backfill policy for legacy rows (Phase 8 dependency).
