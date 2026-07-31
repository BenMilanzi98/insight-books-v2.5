# Duplicate Implementation Register

| Duplicate | Locations | Resolution |
|-----------|-----------|------------|
| Budget authoring | BF expense budgets, PlanV2 budgets, Legacy Budget | Single greenfield `Budget` |
| Forecast authoring | BF revenue forecasts, PlanV2 forecast versions, `/api/forecasts` heuristics | Single greenfield `Forecast` |
| Variance math | BF pl-vs-actual, PlanV2 variance, V2 BvA foundation | One variance engine + report registry |
| Actuals aggregation | bfActualsEngine vs ledgerQueryService | Accounting V2 only |
| Planning UI | Sidebar BF vs Accounting Financial Planning | One sidebar module |
