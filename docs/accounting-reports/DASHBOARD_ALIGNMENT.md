# Dashboard Alignment

`lib/accountingV2/reporting/dashboardKpiService.js` +
`GET /api/accounting-v2/reports/kpis`, flag
`acctv2_dashboard_canonical_reports`.

## Canonical KPI source

`getDashboardFinancialKpis` computes every financial KPI by calling the same
generators the formal reports use — `generateIncomeStatement` for the period
window and `generateBalanceSheet` as of the window end:

Revenue, Expenses (total operating + CoS + other + finance + tax), Gross
Profit, Net Profit, Cash Balance, Receivables, Payables, Inventory, Total
Assets, Total Liabilities, Total Equity, Working Capital (current-proxy
assets − liabilities), Current Ratio, Debt-to-Equity. Each response carries
the scope window, the integrity statuses of the underlying statements, and
explicit labelling metadata so period activity is never silently mixed with
as-of balances.

Alignment is asserted in tests: KPI revenue/net profit equal the Income
Statement's, KPI cash/assets/equity equal the Balance Sheet's, for identical
scopes.

## Legacy KPI routes

The existing `/api/dashboard/*` endpoints (metrics, financial-position,
income-expenses, receivables, payables, ...) still use the old mixed
operational/stored-balance calculations — documented as defects in
CURRENT_REPORTING_ARCHITECTURE.md. Rollout plan: the dashboard UI switches to
`/api/accounting-v2/reports/kpis` per business behind the flag (Stage 7),
after which the legacy KPI computations are retired. Cash-day/POS operational
widgets (non-financial-statement figures) remain operational by design.
