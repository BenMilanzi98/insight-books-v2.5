# Phase 13 — Phases 1–12 Evidence Index

Evidence for financial planning. No invented findings.

| Source phase | Finding / decision | Planning implication | Blocking? | Required Phase 13 action | Evidence path | Status |
|---|---|---|---|---|---|---|
| 1 | Financial-report lineage | Actuals must use GL lineage | Blocking | Historical Dataset from canonical reports | `docs/accounting-audit/FINANCIAL_REPORT_LINEAGE.md` | Reviewed |
| 1 | TB / GL forensic | Unbalanced history unsuitable for high-confidence baseline | Policy | Data-quality status LIMITED / MATERIAL_EXCEPTIONS | Phase 1 reports | Reviewed |
| 2 | Actual vs forecast separation | Planning tables ≠ Journal Entries | Blocking | PlanV2* separate from JournalEntry | Architecture docs | Reviewed |
| 3 | FS / cash-flow mappings | Projection lines use CoA categories | Blocking | Driver → account/category mapping | `docs/accounting-coa/*` | Reviewed |
| 4 | Exact decimals; journal immutability | Planning uses minor units; never posts | Blocking | Exact decimal policy in engine | Phase 4 | Reviewed |
| 5 | Canonical GL query | Period movements = actual source | Blocking | Historical Dataset Service | Phase 5 | Reviewed |
| 6 | Historical exceptions | Disclose in confidence | Non-blocking | Quality assessment | Phase 6 | Reviewed |
| 7 | Reports + Budget-vs-Actual foundation | Prefer report engine actuals; BvA exists | Blocking | Consume IS/BS/CF; replace float BvA for V2 | `docs/accounting-reports/*` | Reviewed |
| 8 | Periods / closed snapshots | Prefer closed-period actuals | Blocking | closedActualsPreferred config | Periods docs | Reviewed |
| 9–11 | Ops / bank / equity | Drivers may use ops; actuals stay GL | Non-blocking | Schedule drivers from modules | Integration docs | Reviewed |
| 12 | Closed FY / PCTB / annual snapshots | Trusted history for baselines | Blocking | Prefer close snapshots | `docs/accounting-close/PHASE_13_READINESS.md` | Reviewed |
| Legacy | `Budget`, `Bf*`, `forecastingService` (Float) | Mutable plans; no three-statement; no lineage | Blocking | PlanV2 parallel; legacy read-only adapter | schema + `lib/bfService.js` | Mapped |

## Authority rule

Actual financial values for planning = canonical Financial Reporting / GL only.  
Budget and Forecast values never create Journal Entries.
