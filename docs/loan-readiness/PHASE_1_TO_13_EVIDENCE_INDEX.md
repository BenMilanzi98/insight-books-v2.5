# Phase 1–13 Evidence Index (Loan Readiness)

Findings recorded from repository docs only — not invented.

| Source phase | Finding / decision | Dataset / report | Phase 14 use | Evidence path | Remaining uncertainty |
|---|---|---|---|---|---|
| 1 | Forensic audit / GL integrity | Historical quality | Data-quality dimension | `docs/accounting-audit/*` | Per-business exceptions |
| 2 | Actual vs forecast separation | Architecture | Proposed facilities never post to GL | `docs/accounting-architecture/*` | — |
| 3 | Debt / equity / cash CoA mappings | Account registry | Leverage & DSCR inputs | `docs/accounting-coa/*` | Mapping completeness |
| 4–5 | Canonical JE / GL / exact decimals | GL query | Actual financial evidence | Phase 5 reports | — |
| 6 | Historical anomaly registry | Exceptions | Confidence reduction | repair docs | Open anomalies |
| 7 | FS + ratios foundation | Reports / snapshots | Historical analysis | reporting docs | Interest coverage exists; DSCR absent |
| 8–12 | Closed periods, YE close packs | Snapshots | Preferred historical evidence | `docs/accounting-close/*` | Close exceptions |
| 9 | Loan module = Liability register | Operational + GL | Existing debt analysis | Liability APIs / LOAN reporting | Schedule UI-only |
| 10 | Bank reconciliation | Cash evidence | Liquidity / data quality | bank recon docs | Unreconciled accounts |
| 11 | Equity reconciliation | Equity | Leverage denominators | equity docs | — |
| 13 | Three-statement forecasts + KPIs | PlanV2* | Projected DSCR / capacity | `docs/financial-planning/PHASE_14_READINESS.md` | Opening BS snapshot coverage |

**Confirmed gap:** No `loanReadiness` module, DSCR engine, debt-capacity engine, covenants, lender packages, or readiness score existed before Phase 14.
