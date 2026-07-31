# Current Financial Planning Architecture (pre–Phase 13)

## Legacy surfaces

| Component | Location | Notes |
|---|---|---|
| `Budget` / `BudgetItem` | Prisma + `lib/budgetService.js` | Float amounts; stores `actualAmount` on lines |
| `BfExpenseBudget*` / `BfRevenueForecast*` | `lib/bfService.js`, `/budget-forecast` | CoA-linked plans; actuals via `bfActualsEngine` |
| `forecastingService.js` | Moving average / exponential / linear regression | Uses `getAccountBalanceDetails`; JS floats; no three-statement |
| Income statement BvA | `lib/incomeStatementService.js` | Optional budget overlay |
| Reports V2 BvA | `generateBudgetVsActual` | Foundation only |
| Permissions | `budgets.*` | Shared Budget & Forecast module |
| UI | `/budget`, `/budget-forecast` | Operational planning UI |

## Defects for Phase 13

1. No Assumptions Engine / versioned scenarios.
2. No integrated three-statement projection (P&L + CF + BS).
3. No guarantee projected BS balances or CF cash = BS cash.
4. Float arithmetic; limited lineage.
5. Forecasts/budgets can look like editable “truth” without immutable approved versions.
6. AI forecasting not governed.
7. Operational actual paths may bypass canonical V2 reports.
8. No rolling forecast / scenario isolation model.

## Decision

Implement `lib/financialPlanning/` + `PlanV2*` tables. Legacy BF remains readable via adapters; new work posts **zero** journals.
