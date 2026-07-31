# Current Closing Architecture (pre–Phase 12)

## What exists today

### Period-end (Phase 8) — implemented

| Component | Location | Behaviour |
|---|---|---|
| Financial year / periods | `AcctV2FinancialYear`, `AcctV2AccountingPeriod` | Status OPEN / CLOSING / CLOSED / REOPENED |
| Period Close Run | `AcctV2PeriodCloseRun` + tasks / exceptions / snapshots | Versioned checklist close |
| Checklist templates | `periodCloseChecklist.js` | STANDARD_MONTHLY_CLOSE including bank recon AUTOMATIC |
| Close / reopen / reclose | `periodCloseService.js`, `periodReopenService.js` | Atomic period lock; reopen with approval path |
| UI | `app/financial-calendar-v2/page.js` | Calendar + period close workspace |
| APIs | `app/api/accounting-v2/periods/**` | CRUD, close, reopen, integrity |

**Period close does:** module checklist, snapshots, lock period, reject normal postings into closed periods.

**Period close does not:** close temporary IS accounts, Income Summary, profit→RE transfer, Post-Closing TB, annual close pack, FY closure ceremony with closing journals.

### Year-end — mostly absent

| Search term | Result |
|---|---|
| `YEAR_END_CLOSE` | Event enum stub only (`lib/accountingV2/domain/enums.js`) |
| `closeYear` / closing journal / incomeSummary close | No V2 year-end closing journal generator |
| `postClosingTrialBalance` | Not implemented |
| FY status CLOSED | Field exists; no Closing Journal Batch prerequisite |
| Direct `accountBalance = 0` resets | Not found as authoritative close path in V2 |

### Related systems

- **Reports V2:** Income Statement / BS / SCF / SOCIE — used for validation inputs.
- **Equity V2:** Capital, drawings, dividends, RE controls — must not dual-count at YE.
- **Bank recon V2:** Feeds period-close; must gate year-end readiness.
- **Posting Engine:** Sole authority for any closing journal lines.

## Defects / gaps for Phase 12

1. No Business Closing Configuration (method, Income Summary, RE destination).
2. No Year-End Close Run distinct from Period Close Run.
3. No temporary-account closure or profit transfer journals.
4. No Post-Closing Trial Balance.
5. No controlled FY close requiring PCTB + snapshots.
6. No YE reopen impact analysis / closing journal reversal.
7. Continuous-ledger carry-forward not documented as default (must remain: no duplicate OB journals).

## Decision

Build `lib/accountingClose/` + `CloseV2*` tables. Reuse Phase 8 period close for month-end. Year-end Close Run orchestrates adjustments → ATB → Closing Journal Batch → PE → PCTB → FY CLOSED → next FY.
