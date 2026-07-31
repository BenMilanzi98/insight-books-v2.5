# Observability Guide

## Structured logging

All engine paths log through the shared accounting logger
(`logAccountingOperation` / audit helpers), giving every event: business,
report type, scope window, definition version, accounting data version,
integrity status, duration, request id, correlation id and error code on
failure. Amount-level payroll/banking detail is not logged — only totals,
statuses and identifiers.

Logged events: report generation (per type), trial balance generation with
balanced/unbalanced outcome, validation findings (rule codes), drill-down
requests, exports (format + filters hash), run review/approval, snapshot
creation/supersession, cache hit/rebuild/reconcile, reconciliation runs,
cross-business rejections (security events), and KPI requests.

## Metrics from persisted records

`AcctV2ReportRun` doubles as the metrics source: counts of reports generated
per type/status, balanced vs unbalanced trial balances, integrity status
distribution, approvals and supersessions are simple aggregations over it.
Cache hit/staleness comes from `AcctV2ReportCache` (`builtAt`,
`sourceDataVersion` vs current). Reconciliation findings quantify
control-account differences, drill-down differences and cache differences per
run.

## Duration tracking

Generation and export durations are captured in the log payloads; the
performance validation doc records the benchmark methodology. Dashboards or
alerting on these logs/tables (e.g. unbalanced-TB rate per business) are an
operations task; the data contract for them is stable.
