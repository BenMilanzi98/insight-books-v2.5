# Phase 4 Scope

## In scope

- Canonical analytics event catalogue (versioned)
- Transactional outbox (analytics plane only)
- Event publication, idempotent consumption, checkpoints, DLQ, retry/replay
- Provenance / source-record traceability
- Tenant scope + actor/session context on events
- Privacy classification, redaction, retention hooks
- Backfill (from real rows only) + reconciliation
- Data freshness + quality incident records
- Fact tables + daily/monthly snapshot foundation
- Aggregation/rebuild jobs
- Pipeline health admin UI + APIs
- en/ny, a11y, automated tests

## Out of scope

- Executive KPI / MRR / ARR / health / churn dashboards
- CRM lead/pipeline/demo/proposal workflows
- AI narratives
- Billing calculation, accounting, MRA EIS fiscal behaviour changes
- Invented historical events
- Writing BI events into `AcctV2Outbox` or `MraEisOutbox`

## Completion gate

Analytics totals for wired event types reconcile to operational sources; read models rebuildable; pipeline health visible to authorised admins.
