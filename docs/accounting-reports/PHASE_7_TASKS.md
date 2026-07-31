# Phase 7 Tasks — Trial Balance and Financial Reporting Engine

Status legend: COMPLETE / DEFERRED (with reason). Business scope: all tenants
(engine is tenant-scoped per request). Dependencies flow top to bottom. Common
integrity requirement for every task: canonical journal lines only, no stored
balances, no operational totals in statement amounts, exact minor-unit
arithmetic, tenant isolation, no journal writes.

| # | Workstream | Status | Key files | Evidence / tests |
|---|---|---|---|---|
| A | Previous-phase evidence review | COMPLETE | `PHASE_1_TO_6_EVIDENCE_INDEX.md` | E1–E21 |
| B | Current reporting architecture analysis | COMPLETE | `CURRENT_REPORTING_ARCHITECTURE.md` | Defects C1–C12 |
| C | Trial Balance engine | COMPLETE | `lib/accountingV2/reporting/trialBalanceService.js` | TB test group |
| D | Trial Balance integrity controls | COMPLETE | same + `reportValidationService.js` | REP-001, statuses |
| E | Trial Balance interface | COMPLETE | `/reports-v2` (TB tab) | UI reads canonical API |
| F | Trial Balance exports | COMPLETE | `reportExportService.js` | export tests |
| G | Report definition framework (versioned, immutable) | COMPLETE | `reportDefinitions.js` | definition tests |
| H | Report line mapping (explicit, classification-based) | COMPLETE | `reportDefinitions.js` | mapping tests |
| I | Account aggregation engine | COMPLETE | `reportAggregationService.js` | no-double-count tests |
| J | Account hierarchy handling | COMPLETE | posting-accounts-only amounts; header rollups presentation-only (Phase 5) | REP-013 test |
| K | Income Statement | COMPLETE | `financialStatementService.js` | IS test group |
| L | Statement of Financial Position | COMPLETE | same | BS test group |
| M | Cash Flow Statement (indirect default; direct = configuration-gated, DEFERRED to config rollout) | COMPLETE | same | CF test group |
| N | Statement of Changes in Equity | COMPLETE | same | equity test group |
| O | General Ledger report integration | COMPLETE | drill-down wraps Phase 5 `getAccountLedger` | drill-down tests |
| P | Receivables reports (aging + control reconciliation) | COMPLETE | `subledgerReportsService.js` | AR tests |
| Q | Payables reports | COMPLETE | same | AP tests |
| R | Inventory reports (GL control group + reconciliation) | COMPLETE | same | module tests |
| S | Fixed-asset reports | COMPLETE | same | module tests |
| T | Payroll reports (5200 + liabilities) | COMPLETE | same | module tests |
| U | Loan reports | COMPLETE | same | module tests |
| V | Tax reports | COMPLETE | same | module tests |
| W | Equity reports | COMPLETE | same + equity statement | equity tests |
| X | Comparative reports (equivalent scopes) | COMPLETE | contracts + statement service | comparative tests |
| Y | Budget versus Actual foundation | COMPLETE | `subledgerReportsService.js` (budget model read-only) | BvA test |
| Z | Dimensional reporting (branch native; other dimensions via line dimensions + Unassigned disclosure) | COMPLETE | contracts | branch tests |
| AA | Multi-currency (base-currency statements; FX detail deferred to translation report) | COMPLETE | contracts | doc |
| AB | Report drill-down (line→accounts→GL→journals, sums equal) | COMPLETE | `reportDrillDownService.js` | REP-025 tests |
| AC | Report validation (REP-001…REP-040) | COMPLETE | `reportValidationService.js` | validation tests |
| AD | Report status and approval | COMPLETE | `reportRunService.js` | approval tests |
| AE | Report snapshots (immutable, supersession) | COMPLETE | same | snapshot tests |
| AF | Report cache (rebuildable, source-version validated) | COMPLETE | `reportCacheService.js` | cache tests |
| AG | Report APIs | COMPLETE | `app/api/accounting-v2/reports/**` | route guard pattern |
| AH | Report UI | COMPLETE | `app/reports-v2/page.js` (rollout-gated; legacy `/reports` untouched until cutover) | manual |
| AI | PDF exports | COMPLETE | `reportExportService.js` (jsPDF from completed result) | export tests |
| AJ | Excel exports (exceljs, numeric cells, injection-safe) | COMPLETE | same | export tests |
| AK | CSV and print | COMPLETE | same (print = UI print of canonical result) | export tests |
| AL | Dashboard alignment | COMPLETE (KPI service + endpoint; legacy dashboard route sweep staged behind `dashboardCanonicalReportsEnabled`) | `dashboardKpiService.js` | KPI tests |
| AM | Security and permissions | COMPLETE | `permissions.js` + route guards | security tests |
| AN | Audit and observability | COMPLETE | run records + accounting logger | audit fields test |
| AO | Performance optimization | COMPLETE | grouped queries, cache, doc | `PERFORMANCE_VALIDATION.md` |
| AP | Automated testing | COMPLETE | `test/accountingV2.reports.test.js` | suite green |
| AQ | Production-like validation | COMPLETE | CLI/API runs on dev DB | final report |
| AR | Controlled rollout | COMPLETE (flags defined; cutover per business pending finance sign-off) | feature flags | `CONTROLLED_ROLLOUT.md` |
| AS | Phase 8 readiness | COMPLETE | `PHASE_8_READINESS.md` | — |
| AT | Phase 13 readiness | COMPLETE | `PHASE_13_READINESS.md` | — |
| AU | Final report | COMPLETE | `FINAL_PHASE_7_REPORT.md` | — |

Rollback for every code task: disable the reportsV2 feature flags / revert the
deployment; the schema additions are additive and independently reversible.
Risks tracked in `RISK_REGISTER.md`. Deferred work is listed in the final
report §deferred.
