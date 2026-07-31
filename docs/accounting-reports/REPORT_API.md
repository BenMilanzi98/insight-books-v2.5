# Report API

All routes live under `/api/accounting-v2/reports/*`, use `requireApiContext`
(session → business context), enforce per-report-type permissions
(`reportPermissions.js`), validate parameters through
`normalizeReportRequest`, and never accept raw SQL or arbitrary account
queries.

| Route | Method | Purpose | Permission |
| --- | --- | --- | --- |
| `generate` | GET | Generate any report type (`?type=TRIAL_BALANCE&fromDate=...`); optional `useCache`, `record` | per report type |
| `drill-down` | POST | Regenerate envelope and drill a line (`reportType`, `params`, `lineId`) | type + `reports.viewDrillDown` |
| `drill-down` | GET | Direct GL activity for one account (`accountId`, window) | `reports.viewGeneralLedger` |
| `export` | GET | CSV / Excel / PDF from the canonical envelope | type + `reports.export` |
| `runs` | GET | List report runs (audit) | `reports.view` |
| `runs/[id]` | POST | `review` / `approve` / `snapshot` | `reports.review` / `.approve` / `.snapshot` |
| `reconciliation` | POST | Independent cross-report reconciliation | `reports.viewIntegrity` |
| `reconciliation` | GET | Unmapped account report | `reports.viewIntegrity` |
| `cache` | POST | `rebuild` / `reconcile` cache | `reports.rebuildCache` |
| `kpis` | GET | Canonical dashboard KPIs | `reports.view` |

Report generation is **read-only** with respect to accounting data — the only
writes are run/snapshot/cache/audit records. Responses are the standard
envelope; errors use the shared accounting error contract with request ids.
Feature flags (`acctv2_trial_balance_v2`, `acctv2_financial_reports_v2`, etc.)
gate each surface server-side. Legacy `/api/reports/*` routes remain untouched
for the controlled rollout comparison window.
