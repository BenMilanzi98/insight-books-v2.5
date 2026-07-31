# Legacy Planning Migration Strategy

## Inventory (Stage 1)

Existing legacy surfaces (read-only for V2 cutover):

- `Budget` / `BudgetItem` Prisma models
- `BfExpenseBudget*` / `BfRevenueForecast*` via `lib/bfService.js`
- `lib/forecastingService.js` (floating-point, no three-statement)
- UI `/budget-forecast/*`

## Stages

1. **Inventory** — classify confidence; preserve originals.  
2. **Canonical scope** — map clear business/period keys into `PlanV2*`.  
3. **Version** — create assumption sets + forecast versions; mark unsupported as legacy exceptions.  
4. **Recalculate** — compare V2 engine vs legacy; do not silently replace approved legacy plans.  
5. **Cutover** — new cycles on V2; uncertain legacy remains read-only (`legacyPlanningReadEnabled`).

## Rules

- Never post migrated budgets/forecasts to GL.  
- Never overwrite approved V2 snapshots with legacy recalculation.  
- Floating-point legacy amounts converted via exact decimal parse where migrated.
