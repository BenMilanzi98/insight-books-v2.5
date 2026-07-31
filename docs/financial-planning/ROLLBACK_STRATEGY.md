# Rollback Strategy

## Safe rollback

1. Set `financialPlanningV2Enabled` (and related PLANNING_FLAGS) to `enabled: false` for tenant or `*`.  
2. Hide `/financial-planning` via permissions / flags.  
3. Keep legacy `/budget-forecast` read path if needed.  

## Must preserve

- `PlanV2Budget*`, `PlanV2Forecast*`, assumptions, scenarios, snapshots, AI suggestion history  

## Must not

- Delete approved forecasts/budgets  
- Alter GL journals  
- Post planning values to GL  
- Merge scenario data  
- Hide failed integrity findings  
