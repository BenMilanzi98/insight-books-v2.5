# Accounting Periods Audit

Run: `npm run audit:forensic -- --module periods` • Source: `lib/accountingPeriodService.js`,
`app/api/accounting-periods/*`, `AccountingPeriod` model.

## How periods actually work (verified)

- Periods are rows in `AccountingPeriod` (`periodType` Monthly|Yearly, `status` open|closed),
  unique on `(tenantId, periodType, startDate)`.
- Period assignment is **date-inference only**: neither `Transaction` nor `JournalEntry` stores a
  period id. `assertPeriodOpen(tenantId, date)` looks up any period containing the date and
  throws if a `closed` one matches.
- **If no period covers the date, posting is allowed** (fail-open): period control only exists
  where someone created the period rows.
- Close/reopen via API with `closedAt/closedById/reopenedAt/reopenedById/reopenReason` audit
  fields. Reopen requires a reason at the API layer; the column is nullable so legacy/reopened
  rows may lack one (PER-004 checks).
- Period enforcement depends on each posting path calling `assertPeriodOpen`. The central
  engine (`postGlEntry`) always calls it; **any path bypassing the engine bypasses period
  control** (see `ACCOUNTING_POSTING_MATRIX.md` for bypass list).
- Operational edits (invoice/expense update/delete) are guarded inconsistently — some routes
  check `accountingPeriodAccess`, others don't; edits to *source documents* dated in closed
  periods are not uniformly blocked.
- **Year-end closing does not exist**: no code closes revenue/expense into retained earnings.
  `3300 Current Year Earnings` / `3200 Retained Earnings` receive no closing journals.
  Financial years are approximated by Yearly period rows only.

## Data findings (current DB)

| Check | Result |
|---|---|
| Overlapping periods (PER-003) | Yearly rows `QA-FY 2025 (closed)` `2024-12-31 → 2025-12-31` and `QA-FY 2026` `2025-12-31 → 2026-12-31` **share the boundary day**; monthly `Jun 2026` rows start `2026-05-31` (end of May inside "June") — period boundaries are stored as UTC-shifted timestamps, so **boundary-day transactions match two periods**. Which period wins depends on query order; a closed FY 2025 and open FY 2026 both matching 2025-12-31 means closed-period control on that day is ambiguous. |
| Monthly gaps | Only single months exist per tenant (Jun/Jul 2026) — all other months are uncovered → **fail-open**: postings dated outside them face no period control (structural PER-001 exposure; engine flags posted transactions without coverage — 0 currently because QA data is dated inside Jun 2026). |
| Closed-period postings (PER-002) | 0 (no transaction created after its period closed) |
| Reopened without reason (PER-004) | 0 |
| Journals without period linkage | **All** (by design — no period FK; schema weakness W6) |

## Defects to carry into Phase 2

1. Fail-open period control (no covering period = no control).
2. Boundary-day ambiguity from UTC-shifted `startDate`/`endDate` (double coverage).
3. No period/financial-year FK on journals; reports re-derive boundaries per query.
4. No year-end closing process; retained earnings never updated.
5. Period enforcement decentralized — relies on every posting path calling `assertPeriodOpen`.
