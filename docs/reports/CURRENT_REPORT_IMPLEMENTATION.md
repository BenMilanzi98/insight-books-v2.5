# Current Report Implementation

**Date:** 2026-07-22  
**Scope:** Forensic inventory of `/reports`, related APIs, services, exports, and Accounting V2 reporting.  
**Status:** **SUPERSEDED** — cutover CLOSED. See [FINAL_REPORT_REIMPLEMENTATION_REPORT.md](./FINAL_REPORT_REIMPLEMENTATION_REPORT.md).

> This document is the **pre-cutover forensic snapshot**. Product hub is now `/reports-v2` only; legacy `/reports` redirects; legacy cash-flow API is retired (410).

---

## 1. Executive summary

*(Historical — before cutover.)* InsightBooks had **two parallel reporting stacks**:

| Stack | Entry | Financial authority |
|---|---|---|
| **Legacy** | `/reports` (`app/reports/page.js`) | Posted `TransactionLine` + posted manual `JournalEntryLine` via `officialLedgerEngine` |
| **Accounting V2** | `/reports-v2` | Posted `JournalEntry` / `JournalEntryLine` with `architectureVersion = ACCOUNTING_V2` only |

**Post-cutover:** the UI hub is **Accounting V2 only**. Ops money paths for the selector catalogue are JE-first on `/reports-v2`. Residual legacy API files may still exist for deletion backlog.

---

## 2. UI routes

| Route | File | Role |
|---|---|---|
| `/reports` | `app/reports/page.js` | Legacy hub + Jump-to-report selector |
| `/reports/financial` | `app/reports/financial/page.js` | Lighter overview; dashboard APIs, not full GL engine |
| `/reports-v2` | `app/reports-v2/page.js` | Canonical V2 reporting UI |
| `/trial-balance` | `app/trial-balance/page.js` | Separate TB UI |

Related (out of selector): suppliers/budget/HR report pages.

### Jump-to-report catalog

- Loaded via `fetchAvailableReports()` → `GET /api/reports/available`
- Static list in `app/api/reports/available/route.js`
- Report ids: `profit-loss`, `profit-analysis`, `balance-sheet`, `cash-flow`, `tax-summary`, `sales-report`, `expense-report`, `stock-movement`, `inventory-loss-report`, `pos-daily`
- Placeholder label remains “Dashboard / Jump to report…” until a report is selected (UX defect)
- `availableReports.filter` crash: **already guarded** (2026-07-22) with `Array.isArray` in page + service

---

## 3. Legacy report APIs (`app/api/reports/**`)

| API | Purpose | Primary data path |
|---|---|---|
| `available` | Catalog | Static |
| `income-statement` | P&L | `getProfitAndLossReport` (GL) |
| `balance-sheet` | BS | `getBalanceSheetReport` (GL) |
| `balance-sheet/account-trace` | Account sources | GL |
| `cash-flow` | Cash flow | Single-tenant: GL; **multi-tenant: ops** `generateCashFlowFromAccounts` |
| `trial-balance` (+ export) | TB | Official ledger merge-rollup |
| `tax-summary` | Tax | Hybrid ops tax lines + GL |
| `sales` | Sales | Ops invoices/sales + GL reconcile panel |
| `expenses` | Expenses | Ops expenses + GL reconcile |
| `stock-movement` | Stock moves | Inventory ops |
| `inventory-losses` | Losses | Write-off / stock-out ops |
| `pos-daily` | Daily POS | POS ops |
| `product-profit-detail` | Item profit | Invoice + POS lines |
| `financial-ratios` | Ratios | From GL P&L/BS |
| `financial-analytics` | Analytics | Mixed |
| `summary` | Summary cards | incomeStatement helpers |
| `account-drilldown` | GL drill | Ledger |
| `gl-reconciliation` | Integrity | TB / journals |
| `[reportType]/export` | PDF/XLSX/CSV | Main exporter |
| `export/[reportType]/export` | Claimed export | **Stub** |
| `ratios` | Ratios | **Mock hardcoded** |
| AR/AP aging, inventory-valuation, sales/expense/profitability-analysis | Retired | **410** |

Dead/legacy generators (`generateIncomeStatement` / `generateBalanceSheet` from invoices) still exist inside some route files alongside GL paths.

---

## 4. Accounting V2 report APIs

| Route | Role |
|---|---|
| `/api/accounting-v2/reports/generate` | Canonical generate |
| `export` | Same envelope as screen |
| `drill-down` | Line → accounts → JE lines |
| `reconciliation` | Validation / unmapped |
| `cache` | `AcctV2ReportCache` |
| `runs`, `runs/[id]` | Review / approve / snapshot |
| `kpis` | Dashboard KPIs |

Models: `AcctV2ReportRun`, `AcctV2ReportSnapshotV2`, `AcctV2ReportCache`.

---

## 5. Key services

| Service | Path | Authority |
|---|---|---|
| Client fetch | `app/services/financialReportingService.js` | Legacy APIs |
| Official V1 ledger | `lib/officialLedgerEngine.js` | TxLine + manual JE |
| P&L from GL | `lib/reportingEngine/buildProfitAndLossFromGl.js` | Journals |
| BS from GL | `lib/reportingEngine/buildBalanceSheetFromGl.js` | Journals |
| Tax from GL | `lib/reportingEngine/buildTaxSummaryFromGl.js` | Journals |
| Cash flow GL | `lib/cashFlowGlService.js` | Journals |
| Cash flow ops | `lib/cashFlowService.js` | Payments/expenses/assets/loans |
| Expense rollup codes | `lib/incomeStatementOperatingExpenseRollup.js` | Hardcoded `5200`/`5400`/… |
| POS daily | `lib/posDailyReportService.js` | Ops |
| V2 facade | `lib/accountingV2/reporting/financialReportService.js` | JE V2 only |
| V2 statements | `…/financialStatementService.js` | JE V2 only |
| V2 source | `lib/accountingV2/ledger/canonicalJournalSource.js` | Never TransactionLine |

---

## 6. Hierarchy / CoA

- V1 skips group headers; parents-with-children handling in `fetchOfficialLedgerRows` / `accountClassification`
- Merge rollup via `accountMergeRollup`
- Operating expense code rollups to system codes
- V2: `hierarchyLevel` + `assignAccountsToLines` in report definitions
- **Master-prompt full versioned ReportAccountMapping registry for `/reports` selector:** not the primary path for legacy hub

---

## 7. Exports

| Path | Real? |
|---|---|
| `/api/reports/[reportType]/export` | Yes (csv/xlsx/pdf) for major types |
| `/api/reports/trial-balance/export` | Yes |
| `/api/accounting-v2/reports/export` | Yes (same envelope) |
| `/api/reports/export/[reportType]/export` | Stub |
| `/api/reports/ratios` | Mock |

Legacy exports are not proven to share one immutable Report Result with screen for all 10 types.

---

## 8. Permissions / audit / cache

- Legacy: scattered `reports.*` / module permissions; not the full granular matrix from the master prompt
- V2: accounting report permissions + run/snapshot audit
- Legacy hub: **no** Business-scoped report cache model equivalent to `AcctV2ReportCache`

---

## 9. What is reusable

1. Accounting V2 report engine (generate, drill-down, export, cache, runs).  
2. GL builders for P&L/BS/TB under legacy (`accountingReportService`).  
3. Account-trace / gl-reconciliation endpoints.  
4. Existing export pipeline for several report types.  
5. Catalog API + selector shell (after UX fixes).

---

## 10. What is dangerous

1. Dual ledger definitions (TxLine+JE vs JE V2).  
2. Multi-tenant cash flow using operational cash path.  
3. Sales/expenses/POS/stock/loss leading with ops for financial totals.  
4. Hardcoded CoA rollup codes.  
5. Float/`Number` money in aggregations.  
6. Stub/mock endpoints still reachable.  
7. Dead invoice-based generators remaining in route files.  
8. Incomplete account-code/name lineage on every line for all 10 reports.  
9. Selector placeholder UX and incomplete mobile filter story.
