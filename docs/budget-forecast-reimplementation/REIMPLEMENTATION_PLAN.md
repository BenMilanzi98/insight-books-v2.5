# Reimplementation Plan

Aligned with greenfield Option 4.

1. Audit pack (Wave 0) — done in this folder  
2. Rename LegacyBudget* + add greenfield schema  
3. Domain: state machines, variance, utilization, completion  
4. `resolveBudgetActuals` on Accounting V2  
5. Budget APIs + UI under `/budget-forecast/budgets`  
6. Forecast Engine + UI under `/budget-forecast/forecasts`  
7. Report registry + UI under `/budget-forecast/reports`  
8. Migrate BF / PlanV2 data; cutover redirects  
9. Permissions, security tests, reconciliation tests  
10. Final readiness decision  

**Money:** integer minor units. **No journals from planning.**
