# Budget & Forecast Greenfield Reimplementation

**Decision:** Option 4 — greenfield models under `/budget-forecast/*`, migrate from BF + PlanV2, deprecate legacy stacks.

**Actuals source of truth:** Accounting V2 posted journals via `ledgerQueryService` / `canonicalJournalSource`. Budgets and forecasts never post.

**Waves:**

| Wave | Deliverable |
|------|-------------|
| 0 | Forensic audit pack (this folder) |
| 1 | Schema + state machines + actuals/variance engines |
| 2 | `/budget-forecast/budgets` + APIs |
| 3 | `/budget-forecast/forecasts` + Forecast Engine |
| 4 | `/budget-forecast/reports` + exports |
| 5 | Cutover, permissions, tests, readiness |

See `REIMPLEMENTATION_PLAN.md` for ordered tasks.
