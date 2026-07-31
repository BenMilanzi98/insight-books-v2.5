# Observability Guide

Structured logging uses the existing `logAccountingOperation` pipeline
(operation name, tenant, user, request id, correlation id, duration, outcome,
sanitized error codes).

## Logged operations

`repair.detect` (per detection pass: rules run, anomalies recorded/updated),
`repair.evidence.add`, `repair.propose`, `repair.decide` (approve/reject +
reason), `repair.batch.create/transition/snapshot`, `repair.dryRun`,
`repair.execute` (action, repair type, journal id, records affected, expected
vs actual impact, duration, replay flag), `repair.rollback`, `repair.verify`
(checks passed/failed, snapshot deltas), plus the posting engine's own logs for
every `HISTORICAL_REPAIR_POSTED` event.

Never logged: attachment contents, full bank account numbers, raw sensitive
evidence payloads (evidence ids are logged; contents require the
`viewSensitiveEvidence` permission to read via API).

## Metrics

Derived from the registry and batch tables (queryable, no separate metrics
store): anomalies detected / approved / repaired / verified by type, severity
and business; repairs failed and rolled back; duplicate journals reversed;
missing journals created; wrong accounts reclassified; unbalanced journals
resolved; exceptions remaining; financial impact repaired (minor units);
ledger reconciliation differences; AR/AP control differences; capital
discrepancy delta; unsupported-liability balance; repair duration and batch
throughput (`startedAt`/`completedAt`, `recordCount`).

The repair console surfaces the operational view (open anomalies by severity,
batch statuses, exception count); `scripts/accounting-repair.mjs list/reconcile
--output` exports the same numbers for reporting.
