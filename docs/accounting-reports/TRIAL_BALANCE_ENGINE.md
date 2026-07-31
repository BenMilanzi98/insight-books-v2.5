# Trial Balance Engine

`lib/accountingV2/reporting/trialBalanceService.js`.

The Trial Balance reads authoritative posted journal lines only, through
`getBusinessLedgerSummary` (Phase 5). Stored account balances are never read.

## Per-account output

For every account with activity (and every account when
`includeZeroBalances`): account code, name, type, category, parent account,
header flag, normal balance, opening debit/credit, period debit/credit
(raw, un-netted movements), closing debit/credit, raw signed net balance,
normal-balance presentation, abnormal-balance status, line count,
comparative closing (when a comparative scope is requested) and a drill-down
reference preserving the report scope.

Opening balances come from all canonical activity strictly before the window
start; closing = opening + movement. Because opening and movement derive from
the same canonical source, an opening balance can never be counted twice
(REP-017).

## Filters

Business (context), date range, as-of date, branch, zero balances,
deprecated accounts (deprecated remain reportable by default), comparative
scope. Department/project/cost-centre slicing is available at drill-down via
journal-line dimensions (see DIMENSIONAL_REPORTING.md).

## Exclusions proven by tests

- Draft journals (status filter) — excluded.
- Cancelled/void transactions — excluded.
- Failed journals — never posted, excluded.
- Shadow journals — separate tables, structurally excluded.
- Mirror journals (`JournalEntry.transactionId` set) — excluded, so legacy and
  V2 effects are counted once; the repaired MK1,000,000 owner-capital event
  appears exactly once.
- Reversals — included as ordinary opposite posted entries; originals remain.

## Adjusted Trial Balance

Adjustments are posted approved journals (Phase 4 manual/adjustment
framework); the adjusted Trial Balance is simply the Trial Balance over a
window that includes them — always derived from journals, never typed. The
unadjusted view is obtained by ending the window before the adjustment
postings. Post-closing Trial Balances arrive with Phase 12 year-end closing.

## Statuses

BALANCED / BALANCED_WITH_WARNINGS / UNBALANCED / BLOCKED — see
TRIAL_BALANCE_VALIDATION.md. Envelope integrity maps to VERIFIED /
VERIFIED_WITH_WARNINGS / UNVERIFIED / BLOCKED.
