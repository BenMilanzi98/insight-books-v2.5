# Phase 12 — Phases 1–11 Evidence Index

Evidence for year-end close. No invented findings.

| Source phase | Finding / decision | Closing implication | Blocking? | Required Phase 12 action | Evidence path | Status |
|---|---|---|---|---|---|---|
| 1 | Period/year-end findings in audit | FY close must be controlled | Blocking if unaddressed | Year-End Close Run + checklist | `docs/accounting-audit/ACCOUNTING_PERIODS_AUDIT.md` | Reviewed |
| 1 | Journal integrity / TB forensic | Closing journals must balance from JE lines | Blocking | Posting Engine only; no plug journals | `docs/accounting-audit/TRIAL_BALANCE_FORENSIC_REPORT.md` | Reviewed |
| 1 | Equity / capital audit | RE/CYE/drawings must not dual-count | Blocking | Canonical equity close path | `docs/accounting-audit/CAPITAL_AND_EQUITY_AUDIT.md` | Reviewed |
| 2 | Service boundaries / posting modes | Close posts via Posting Engine | Blocking | Closing Journal Batch → PE | `docs/accounting-architecture/*` | Reviewed |
| 3 | RE / CYE / Income Summary mappings | Temporary vs permanent accounts | Blocking | Temporary-account validation + close method | `docs/accounting-coa/*` | Reviewed |
| 4 | Adjustment + opening balance frameworks | YE adjustments reuse PE; OB not for continuous carry-forward | Blocking | YE adjustments + continuous GL carry-forward | Phase 4 posting docs | Reviewed |
| 5 | Canonical GL / closing balances | Opening reporting balances from JE lines | Blocking | No duplicate OB journals | Phase 5 GL docs | Reviewed |
| 6 | Historical exceptions | Material exceptions block close | Policy | Exception accept with elevated permission | Phase 6 reports | Reviewed |
| 7 | TB / ATB / FS / CYE / RE controls | ATB before close; PCTB after | Blocking | Generate ATB + PCTB + snapshots | `docs/financial-reporting/*` | Reviewed |
| 8 | Period close run + checklist | Month-end ≠ year-end temporary close | Blocking | Reuse period close; add YE close | `docs/accounting-periods/*` | Reviewed |
| 8 | PHASE_12_READINESS | Closing journals / PCTB / FY close ceremony missing | Blocking | This phase | `docs/accounting-periods/PHASE_12_READINESS.md` | Open → implementing |
| 9 | Module reconciliations | Subledgers feed readiness | Blocking | Close readiness consumes module feeds | `docs/accounting-integrations/PHASE_10_11_12_READINESS.md` | Reviewed |
| 10 | Bank recon period-close feed | Required bank accounts reconciled | Blocking | YE readiness includes bank checks | `docs/bank-reconciliation/*` | Reviewed |
| 11 | Equity RE/CYE / drawings / dividends | Profit transfer once; drawings/dividends not expenses | Blocking | Close method + equity checks | `docs/equity-management/PHASE_12_READINESS.md` | Reviewed |
| 11 | MK1,000,000 capital once | Must remain once through YE | Blocking | No capital as revenue close | Equity FINAL report | Reviewed |

## Selected Current Year Earnings model (Phase 12)

**MODEL A — Calculated reporting line:** CYE is derived from Income Statement accounts during the year; year-end Closing Journals transfer final P/L once to Retained Earnings (or Owner/Partner Capital per method). Post-close presentation shows CYE = 0 for the closed year. Do not also store and add a posted CYE control balance.

See `CURRENT_YEAR_EARNINGS_YEAR_END_TREATMENT.md`.
