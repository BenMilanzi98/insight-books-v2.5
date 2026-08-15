# Budget & Forecast Phase 2 — Forecasting Completeness

**Status:** Approved 2026-08-15  
**Scope:** Phase 2 only (forecast methods UI/engine). Phase 3 (AR/AP cash, assumptions UI, alerts) out of scope.

## Goal

Make Forecasts as usable as Phase 1 Budgets: choose a method, generate from Accounting V2 actuals (optional source budget), edit monthly projections, approve/lock — never posts to the ledger.

## Approach

Extend existing greenfield stack (`lib/budgetForecast`, `/budget-forecast/forecasts`). No new Prisma models.

## Requirements

### Creation wizard
- Types: Rolling, Cash flow, Scenarios (Base+Best+Worst), Draft only
- Methods: `CURRENT_RUN_RATE` | `HISTORICAL_AVERAGE` | `BUDGET_REMAINDER` | `RECURRING` | `MANUAL`
- Fields: name, dates, scenario, optional source budget, growth %, optional department
- Wire to existing POST `/api/budget-forecast/forecasts` actions

### Engine
- Extract pure projection helper for unit tests
- `RECURRING`: monthly amount × period count (from recurringAmount or last-month actual)
- `MANUAL`: CoA lines with zero projections ready for grid edit (from actuals account list or empty)
- `BUDGET_REMAINDER`: prefer/require sourceBudgetId; project max(0, budget − historical)
- Keep run-rate / historical / scenario factors

### Detail page
- Regenerate panel: method, growth, source budget, scenario
- Monthly grid: Account × months + Annual (sum / re-spread)
- PUT `/api/budget-forecast/forecasts/[id]/lines` → `saveForecastLines`
- Workflow: Generate / Submit / Approve / Lock / Activate
- Cash-flow months when type is `CASH_FLOW` if data present

### Dashboard
- Revenue / expense / profit cards from recent generated forecast lines
- Link to BvF report when a forecast is selected

## Non-negotiables
- Planned/projected values never create journals
- Actuals only from Accounting V2 via `resolveBudgetActuals`
- Status only via intent commands
