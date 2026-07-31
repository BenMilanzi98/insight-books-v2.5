# Period Close Tasks

Model: `AcctV2PeriodCloseTask` — materialized from the checklist template at
`beginPeriodClose` (one row per task, `NOT_STARTED`).

## Task statuses

`NOT_STARTED, IN_PROGRESS, PASSED, PASSED_WITH_WARNING, FAILED, BLOCKED,
WAIVED, NOT_APPLICABLE` (`CloseTaskStatus`).

## Automated tasks (`runAutomatedCloseChecks`)

Run against canonical Phase 5/7 services — never independent calculations:

- Trial Balance status from the Phase 7 Trial Balance engine.
- GL ↔ journal-line reconciliation from the ledger reconciliation service.
- AR/AP/inventory/payroll/loan control differences from the report
  reconciliation service.
- Journal posting state, failed postings, drafts and duplicates from the
  V2 journal tables.
- Report generation + integrity from the Financial Reporting Engine.

Each execution stores: rule, execution timestamp, result, expected/actual
values, difference, severity and evidence in `resultJson` — the run's
`trialBalanceStatus` / `reportStatus` / `integrityStatus` roll up from these.

## Manual tasks (`updateManualCloseTask`)

Recorded per completion: user, timestamp, comment, evidence payload, status.
Evidence is mandatory — completion without a comment/evidence is rejected.

## Waivers (`waiveCloseTask`)

Require reason + approver; blocking-task waivers require
`accountingPeriods.overrideMateriality`. Waivers are stored on the task and
audited.
