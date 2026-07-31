# Final Phase 13 Report — Financial Planning V2

## 1. Executive summary

Phase 13 delivers a Business-scoped Financial Planning V2 module: configuration, budgets, forecast cycles/versions, assumptions, scenarios, historical dataset + quality assessment, server-side three-statement projection (`THREE_STATEMENT_V1`), variance helpers, AI suggestion governance (review-only), approval + immutable snapshots, APIs, UI workspace, permissions, and feature flags. Planning data never posts to the General Ledger.

## 2. Previous-phase evidence

Indexed in `PHASE_1_TO_12_EVIDENCE_INDEX.md` (no invented findings). Phase 12 readiness consumed from `docs/accounting-close/PHASE_13_READINESS.md`.

## 3. Existing planning defects (mapped)

Documented in `CURRENT_FINANCIAL_PLANNING_ARCHITECTURE.md` / `PLANNING_DATA_FLOW_MAP.md`: legacy BF tables, float-based `forecastingService`, no three-statement reconciliation, mutable plans, operational actuals risk.

## 4–5. Target architecture & database

- Architecture: `TARGET_FINANCIAL_PLANNING_ARCHITECTURE.md`
- Entities: `PlanV2Configuration`, `PlanV2Scenario`, `PlanV2AssumptionSet`, `PlanV2Assumption`, `PlanV2Budget`, `PlanV2BudgetLine`, `PlanV2ForecastCycle`, `PlanV2ForecastVersion`, `PlanV2ManualOverride`, `PlanV2ForecastSnapshot`, `PlanV2AISuggestion`
- Migration: `prisma/migrations/20260721180000_financial_planning_v2`

## 6–16. Configuration, actuals, budgets, cycles, assumptions, scenarios

Implemented under `lib/financialPlanning/application/*` with APIs under `app/api/financial-planning/*`.

## 17–37. Forecasting & three-statement

Core engine: `domain/threeStatementEngine.js` — P&L, WC, CF, BS, KPIs, cash shortage, burn/runway, lineage notes, checksum, integrity status.

## 38–55. Variance, AI, approval, snapshots, UI

- Variance: `computeVariance` + `/api/financial-planning/variance`
- AI: `aiSuggestionService` + governance doc
- Approve creates immutable `APPROVED_FORECAST` snapshot
- UI: `/financial-planning`

## 56–64. Security, audit, migration, readiness

- Permissions: `financialPlanning.*` in `permissionsMap.js`
- Flags: `PLANNING_FLAGS` (AI not default-enabled)
- Legacy strategy + rollback + Phase 14 readiness docs
- Readiness API: `/api/financial-planning/readiness`

## Confirmations

| Rule | Status |
|---|---|
| Actuals from canonical accounting services | Yes (snapshot preference order) |
| No Budget/Forecast JE posting | Yes (separate PlanV2* tables; engine never calls posting) |
| P&L / CF / BS reconciliation | Yes; INVALID blocks approval |
| Capital/loan/drawing/dividend treatment | Correct in engine lineage |
| Calculation lineage | Per-period methods + assumptions |
| Approved versions immutable | Service-enforced |
| AI requires human review | Yes |
| Cross-business IDs rejected | Tenant predicates on all services |

## Remaining / deferred

- Full dimensional account-level budgets for every CoA line (report-line + account keys supported)
- Production opening BS auto-load for every tenant (depends on approved BS snapshot coverage)
- Full PDF branding pack (Excel/JSON export delivered)

## Deployment status (2026-07-21)

- PostgreSQL restarted via Scoop `pg_ctl`
- `DATABASE_URL` host set to `127.0.0.1` (avoids localhost/IPv6 Prisma P1001)
- Migration `20260721180000_financial_planning_v2` **applied**
- Excel/JSON export: `GET /api/financial-planning/forecasts/[id]/export`

```bash
npx prisma migrate deploy
npx vitest run test/financialPlanning*.test.js
```

Disable: set `financialPlanningV2Enabled` enabled=false for tenant.
