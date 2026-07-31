# Period Close Run

Model: `AcctV2PeriodCloseRun`; service: `periodCloseService.js`.

## Fields

`closeNumber` (monotonic per period), `closeVersion` (increments on
re-close), `status`, `checklistTemplateId`/`Version` (frozen at begin),
`initiatedBy`/`reviewedBy`/`approvedBy`/`closedBy`, `startedAt`/`completedAt`,
`expectedTaskCount`/`completedTaskCount`/`blockedTaskCount`/`warningTaskCount`,
`trialBalanceStatus`, `reportStatus`, `integrityStatus`, `snapshotReference`,
`reason`, `requestId`, `correlationId`, `metadata`.

## Statuses

`DRAFT → IN_PROGRESS → (BLOCKED ⇄ IN_PROGRESS) → READY_FOR_REVIEW →
APPROVED → COMPLETED`, plus `CANCELLED` and `SUPERSEDED`.

## Rules

- One active run per period (`getActiveCloseRun` guard; begin-close rejects
  while a run is active or the period is not OPEN/REOPENED).
- Reopening marks the completed run `SUPERSEDED` — never deleted; a re-close
  creates a **new run** with `closeVersion + 1`.
- The run stores the checklist version used, so later template changes never
  alter historical evidence.
- Cancel (`cancelPeriodClose`) returns the period to OPEN with a reason and
  a `CANCEL_CLOSE` history record; the cancelled run is preserved.
