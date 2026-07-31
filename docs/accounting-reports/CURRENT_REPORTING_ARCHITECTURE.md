# Current Reporting Architecture (pre-Phase 7 inspection)

Inspection date: 2026-07-20. Full route/service inventory below; defects feed
`PHASE_1_TO_6_EVIDENCE_INDEX.md` and the REP-0xx validation rules.

## The two existing stacks

**Stack A — GL-backed (`lib/reportingEngine/` + `lib/accountingReportService.js`).**
Sources posted `Transaction`/`TransactionLine` plus posted non-mirror
`JournalEntry`/`JournalEntryLine` via `getPostedGlSurvivorTotalsForPeriod`
(`lib/trialBalanceReport.js`) → `officialLedgerEngine` → statement builders
(`buildProfitAndLossFromGl`, `buildBalanceSheetFromGl`, `buildTaxSummaryFromGl`).
Powers the live Trial Balance, Income Statement, Balance Sheet APIs and the
single-tenant Cash Flow.

**Stack B — operational/stored-balance (legacy).** `balanceSheetService.js`
(`Account.balance`/`AccountBalance` + unpaid invoices + supplier bills + FIFO
inventory), `incomeStatementService.js` (Sale/Payment/Expense + FIFO COGS),
`cashFlowService.js` (Payment/Expense/Payroll/Asset/Loan), `arAgingService` /
`apAgingService` (Invoice/Expense/SupplierBill). Still powers: the reports
summary hub, financial-ratios single-tenant branch, multi-tenant cash flow,
several PDF export fallbacks, and most dashboard KPIs.

## Route inventory (`app/api/reports/` and related)

Active: `trial-balance` (+`/export`), `balance-sheet` (+`/account-trace`),
`income-statement`, `cash-flow`, `financial-ratios`, `tax-summary`, `sales`,
`expenses`, `summary`, `stock-movement`, `inventory-losses`, `pos-daily`,
`product-profit-detail`, `financial-analytics`, `account-drilldown`,
`integrity`, `gl-reconciliation`, `accounting-periods`, `available`,
`historical/[metric]`, `[reportType]/export`. Retired (HTTP 410 via
`lib/retiredReports.js`): `accounts-receivable-aging`, `accounts-payable-aging`,
`inventory-valuation`, `sales-analysis`, `expense-analysis`,
`profitability-analysis`. `ratios` returns MOCK data. There is **no equity /
statement-of-changes API** and no report snapshot, approval or versioned
definition concept anywhere.

Other: `app/api/general-ledger/*` (GL inquiry + export),
`app/api/suppliers/reports/aging`, `app/api/dashboard/*` (KPIs),
`app/api/budgets/reports`.

## Defect register (confirmed by inspection)

| # | Defect | Where | REP rule |
|---|---|---|---|
| C1 | Dual engines disagree: screen uses GL, some exports/hub use operational | `[reportType]/export` P&L PDF fallback, BS PDF calls the route-local legacy `generateBalanceSheet`, cash-flow export uses `generateCashFlowFromAccounts` | REP-026, REP-032 |
| C2 | Stored `Account.balance`/`AccountBalance` used as truth | `balanceSheetService`, dashboard `financial-position`, `cash-flow` | REP-031, stored-balance rule |
| C3 | Multi-tenant cash flow is operational while single-tenant is GL | `app/api/reports/cash-flow` | REP-004, REP-032 |
| C4 | Financial ratios single-tenant branch calls legacy ops builders despite GL comment | `financial-ratios` | REP-032 |
| C5 | Summary hub KPIs from operational P&L; dashboards mostly operational (Invoice/Sale/Expense direct) | `summary`, `app/api/dashboard/*` | REP-032, dashboard alignment |
| C6 | Trial Balance is period-only (no as-of opening+movement+closing presentation); active-only filter can drop inactive accounts with activity | `trialBalanceReport.js`, TB route | REP-017/036 |
| C7 | Income Statement route lacks the multi-tenant scope TB/BS have | `income-statement` route | REP-027 |
| C8 | `ratios` endpoint returns mock data | `app/api/reports/ratios` | REP-032 |
| C9 | Dead code: route-local legacy `generateBalanceSheet` + unused ops import in BS route | `balance-sheet/route.js` | cleanup |
| C10 | No report definitions/versioning, no snapshots, no integrity statuses, no approval workflow, no drill-down contract, no unmapped-account control | everywhere | Phase 7 core scope |
| C11 | Exports regenerate data server-side per format instead of consuming one completed result | `[reportType]/export` | REP-026 |
| C12 | Aging services live on operational tables with GL control comparison bolted on; APIs retired without replacement | `arAgingService`, `apAgingService` | REP-006/007 |

Notes: the duplicate `getBalanceSheetReport` import previously seen in the BS
route is already fixed (single import today). No Redis/materialized-view report
cache exists; several routes force-dynamic.

## What Phase 7 builds on (Phase 5 surface)

`lib/accountingV2/ledger/`: `canonicalJournalSource.js` (canonical
posted-lines-only source: mirror exclusion, draft/void/shadow exclusion,
header-amount exclusion, authority rules), `ledgerQueryService.js`
(`getBusinessLedgerSummary` = opening/movement/closing per account with
normal-balance presentation and merge rollups; `getAccountLedger` = drill-down
with running balances; `getLedgerHierarchy` = presentation-only parent
rollups), `journalQueryService.js`, `ledgerReconciliationService.js`,
`integrityRules.js`, `ledgerRebuildService.js`. Account rows carry Phase 3
classification: `coaV2Category/SubType/Behaviour/NormalBalance`,
`financialStatementSection/Subsection`, `cashFlowClassification`,
`systemPurpose`, `controlAccountPurpose`, `consolidationGroup`.

Phase 7's engine consumes ONLY this surface — never Stack A's legacy totals and
never Stack B.
