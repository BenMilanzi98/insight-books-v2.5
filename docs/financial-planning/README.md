# Financial Planning V2 (Phase 13)

InsightBooks forward-looking planning: budgets, forecasts, scenarios, assumptions, and an integrated three-statement projection engine.

## Non-negotiables

- Actual accounting data stays in the General Ledger / reporting engine.
- Budget and Forecast values **never** create Journal Entries.
- Approved forecast versions and snapshots are immutable.
- Projected Balance Sheet must balance without a hidden plug.
- Closing Cash on Cash Flow must equal Balance Sheet Cash.
- AI suggestions require human review and never auto-approve.
- Projections are estimates, not guaranteed outcomes.

## Module layout

```
lib/financialPlanning/
  domain/          enums, money, three-statement engine, quality, errors
  application/     config, scenarios, assumptions, budgets, forecasts, AI, readiness
  api/             route guards
  permissions.js
app/api/financial-planning/
app/financial-planning/
docs/financial-planning/
```

## Feature flags

`PLANNING_FLAGS` in `lib/accountingV2/infrastructure/featureFlags.js`.  
Primary: `financialPlanningV2Enabled` (pre-enabled when no DB row; set `enabled: false` to disable).

## Quick verification

```bash
npx vitest run test/financialPlanning.engine.test.js test/financialPlanning.quality.test.js
npx prisma migrate deploy
```

UI: `/financial-planning`
