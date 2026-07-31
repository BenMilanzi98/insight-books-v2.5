# Report Query Audit

| Report path | Source | Class |
|-------------|--------|-------|
| BF `/api/bf/pl-vs-actual` | Planned BF lines + `bfActualsEngine` | REIMPLEMENT |
| Accounting V2 `generateBudgetVsActual` | Legacy `budgetItem` + V2 ledger | EXTEND to greenfield Budget |
| PlanV2 `/api/financial-planning/variance` | Stateless math | REUSE formulas only |
| Heuristic `/api/forecasts/*` | Balance deltas | DEPRECATE |

## Required greenfield reports

Budget vs Actual, Budget vs Forecast, Forecast vs Actual, utilization, cash outlook, scenario compare — all via `BudgetForecastReportDefinitionRegistry` with server-side formulas and export reconciliation.
