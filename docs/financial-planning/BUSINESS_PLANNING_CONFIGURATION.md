# Business Planning Configuration

Entity: `PlanV2Configuration` (one row per `tenantId`).

API: `GET/PUT /api/financial-planning/config`

Statuses: `DRAFT` → `APPROVED` (required for readiness READY).

Defaults: MWK, 12-month horizon, MONTHLY grain, closed actuals preferred, AI suggestions **off**.
