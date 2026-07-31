# Controlled Rollout

Feature flags (`PERIOD_FLAGS` in
`lib/accountingV2/infrastructure/featureFlags.js`, server-controlled,
scopable by environment / business / module / event type):

`CALENDAR_V2, PERIODS_V2, RESOLVER_V2, STRICT_POSTING, CLOSE_WORKFLOW,
REOPEN_WORKFLOW, BACKDATING_APPROVAL, FUTURE_DATING_CONTROL,
CLOSE_CHECKLIST_V2, CLOSE_SNAPSHOTS, INTEGRITY_MONITORING`.

## Stages

| Stage | Scope | Flags |
| --- | --- | --- |
| 1 | Development, synthetic calendars, automated tests | all on in dev |
| 2 | Staging with production-like data; migration preview per business | CALENDAR_V2, INTEGRITY_MONITORING |
| 3 | Production read-only: calendar visible, integrity audits running, no blocking | + PERIODS_V2 |
| 4 | Strict resolver for Manual Journals; close workflow for one pilot business | + RESOLVER_V2 (module-scoped), CLOSE_WORKFLOW (pilot) |
| 5 | Strict controls for selected modules on the pilot | + STRICT_POSTING (module-scoped), BACKDATING_APPROVAL, FUTURE_DATING_CONTROL |
| 6 | Business-by-business activation after readiness = READY | all flags per business |

## Gate

`assertMigrationComplete` + `assessPeriodReadiness` must pass before
enabling `RESOLVER_V2`/`STRICT_POSTING` for a business. A business with
incomplete period mapping keeps legacy behaviour — strict blocking is never
activated globally in one step.
