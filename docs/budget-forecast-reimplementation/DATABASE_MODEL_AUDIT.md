# Database Model Audit

## Existing models

### Legacy (name conflict with greenfield)

- `Budget` — tenant-scoped; Float money; soft version Int; stored approvals/lock
- `BudgetItem` — optional `accountId`; **stores** `actualAmount` / variance
- `RevenueBudgetBreakdown` — branch/category breakdown with stored actuals

**Action:** Rename to `LegacyBudget`, `LegacyBudgetItem`, `LegacyRevenueBudgetBreakdown`.

### BF

- `BfExpenseBudgetHeader` / `BfExpenseBudgetLine` — CoA FK; period string keys; Float planned
- `BfRevenueForecastHeader` / `BfRevenueForecastLine` — same + version label

**Action:** Migrate rows into greenfield; keep tables until cutover cleanup.

### PlanV2

- Configuration, Scenario, AssumptionSet, Assumption, Budget, BudgetLine, ForecastCycle, ForecastVersion, ManualOverride, Snapshot, AISuggestion

**Action:** Migrate mappable assumptions/scenarios; deprecate product use.

## Greenfield target (new)

`Budget`, `BudgetLine`, `BudgetPeriodAmount`, `BudgetVersion`, `BudgetApproval`,  
`Forecast`, `ForecastLine`, `ForecastPeriodAmount`, `ForecastAssumptionSet`, `ForecastAssumption`

Money: **integer minor units**. Actuals never persisted on lines.
