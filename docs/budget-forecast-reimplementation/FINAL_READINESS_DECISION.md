# Final Readiness Decision

**Date:** 2026-07-24  
**Module:** Budget & Forecast greenfield (`/budget-forecast/*`)

## Decision: READY FOR USE (with known follow-ups)

The greenfield module is wired end-to-end:

- Schema: `LegacyBudget*` + `PlanningBudget` / `PlanningForecast` family (migration applied)
- Domain: state machines, variance, utilization, completion, periods
- Actuals: Accounting V2 `getBusinessLedgerSummary` only
- APIs: `/api/budget-forecast/budgets|forecasts|reports|migrate`
- UI: Budgets, Forecasts, Reports under `/budget-forecast/*`
- Cutover: Financial Planning redirects; heuristic `/api/forecasts/*` returns 410; BF expense list proxies to greenfield
- Unit tests: `test/budgetForecast/*` passing

## Confirmations

| Rule | Status |
|------|--------|
| Budget/Forecast lines require CoA `accountId` | Yes |
| Actuals from posted V2 journals | Yes (`resolveBudgetActuals`) |
| No journals / stock from planning | Yes (no posting code paths) |
| No arbitrary status PATCH | Yes (intent commands only) |
| Tenant isolation on queries | Yes (`tenantId` on all loads) |

## Known follow-ups (Medium / not blocking)

1. Full XLSX/PDF export parity (CSV + JSON shipped)
2. Department/project/cost-centre ledger filter push-down beyond branch
3. Richer monthly matrix UI (annual entry + even spread shipped)
4. Async forecast jobs for very large CoAs
5. Drop BF/PlanV2 tables after production soak

## Critical / High defects

**None open** from this implementation pass.
