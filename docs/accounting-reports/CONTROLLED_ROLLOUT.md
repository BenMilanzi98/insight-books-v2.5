# Controlled Rollout

## Feature flags (server-side, per business — `featureFlags.js`)

`acctv2_trial_balance_v2`, `acctv2_financial_reports_v2`,
`acctv2_report_drilldown_v2`, `acctv2_report_exports_v2`,
`acctv2_report_integrity_v2`, `acctv2_report_snapshots_v2`,
`acctv2_report_cache_v2`, `acctv2_dashboard_canonical_reports`.

Every `/api/accounting-v2/reports/*` surface checks its flag; legacy
`/reports` and `/api/reports/*` remain untouched, so V2 runs alongside legacy
for comparison.

## Stages

1. **Development** — synthetic fixtures (done; automated suite).
2. **Staging, production-like data** — restore a production copy, run
   `POST /reports/reconciliation` per business, benchmark the grouped
   aggregation queries, review findings.
3. **Read-only comparison** — enable V2 flags for internal users; compare
   `/reports-v2` against legacy `/reports` per business; differences are
   expected where legacy is defective — each must be explained by a
   documented defect or a Phase 6 exception.
4. **Trial Balance V2 for pilot businesses.**
5. **Core financial statements for pilots.**
6. **Exports.**
7. **Dashboard alignment** (`acctv2_dashboard_canonical_reports`).
8. **Business-by-business rollout**, then legacy report retirement.

## Cutover conditions per business (§73)

Canonical GL enabled; TB balanced or material exceptions disclosed and
approved; mappings complete (unmapped report clean or accepted); no
parent-child double counting (validation clean); CYE not duplicated; owner
capital repair confirmed; unsupported liabilities resolved/disclosed; BS
equation passes; CF reconciles; equity statement reconciles; drill-down
sampling passes; screen = exports; performance acceptable; finance reviewer
approval recorded on a run; rollback rehearsed (flags off restores legacy
instantly).
