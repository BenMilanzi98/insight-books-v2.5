# Business Period Readiness

`lib/accountingV2/periods/periodReadinessService.js` →
`assessPeriodReadiness(db, context)`; exposed in
`GET /api/accounting-v2/periods/integrity` and the UI integrity panel.

## Checks

- Calendar configuration exists (or defaults suffice) →
  `REQUIRES_CALENDAR_CONFIGURATION` when no canonical year exists.
- Canonical financial years present and integrity audit PASSes → `BLOCKED`
  on structural findings.
- A current period covers today.
- Every posted journal carries a canonical period → 
  `REQUIRES_PERIOD_MAPPING` with the unassigned count.
- Blocking historical exceptions (Phase 6 register) →
  `REQUIRES_HISTORICAL_REPAIR`.
- Warnings (non-blocking findings) → `READY_WITH_WARNINGS`.

## Statuses

`READY`, `READY_WITH_WARNINGS`, `REQUIRES_PERIOD_MAPPING`,
`REQUIRES_CALENDAR_CONFIGURATION`, `REQUIRES_HISTORICAL_REPAIR`, `BLOCKED`.

## Per-business export

Run against production-like data per business and export to
`artifacts/accounting-periods/business-period-readiness.csv` (artifacts are
git-ignored; no sensitive data is committed). Strict period flags must not be
enabled for any business whose status is not READY / READY_WITH_WARNINGS —
`assertMigrationComplete` provides the hard guard.
