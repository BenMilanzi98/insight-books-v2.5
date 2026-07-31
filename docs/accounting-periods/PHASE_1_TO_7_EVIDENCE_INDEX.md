# Phase 1–7 Evidence Index for the Period Framework

Findings and binding decisions from earlier phases that constrain Phase 8.
Sources are the phase documentation suites in `docs/accounting/`,
`docs/accounting-backend/`, `docs/chart-of-accounts/`, `docs/accounting-posting/`,
`docs/general-ledger/`, `docs/accounting-repair/` and `docs/accounting-reports/`.

| # | Source | Finding / decision | Phase 8 control required |
| --- | --- | --- | --- |
| E1 | Phase 1 periods audit | Legacy `assertPeriodOpen` fails open (zero periods or query error ⇒ posting allowed) | Deny-by-default resolver for all V2 paths; strict flag per business; readiness gate before enabling |
| E2 | Phase 1 periods audit | No FinancialYear entity; fiscal start month in `TenantSettings` applied inconsistently | Canonical `AcctV2FinancialYear` with business-scoped calendar configuration |
| E3 | Phase 1 periods audit | Monthly and Yearly `AccountingPeriod` rows overlap the same dates (ambiguous coverage) | Canonical monthly periods only, per financial year; PER-102 overlap rule; Yearly rows treated as legacy aliases in migration |
| E4 | Phase 1 periods audit | Lazy current-month creation leaves gaps between periods | Atomic full-year generation; PER-103 gap rule; no partial creation |
| E5 | Phase 1 journal integrity | Legacy journals have no period FK; membership is date-inferred | Journals store resolved `accountingPeriodId` + FY; migration assigns references from posting dates only where evidence is clear |
| E6 | Phase 1 forensic audit | Closed-period violations found on legacy paths that skipped the guard | Central resolver used by the posting engine; every V2 posting passes through it; attempts audited |
| E7 | Phase 2 architecture | Period Resolution Service contract defined; legacy adapter documents NO_PERIOD / AMBIGUOUS / CLOSED decisions | Phase 8 implements the full contract over canonical tables and replaces the adapter behind `periodResolverV2Enabled` |
| E8 | Phase 2 flags | Server-controlled flags with tenant/module/event scope | Period flags follow the same registry (`AcctV2FeatureFlag`) |
| E9 | Phase 4 engine | `resolvePostingPeriod` is server-side, deny-by-default: closed ⇒ typed error, REOPENED ⇒ permission, backdating ⇒ permission, future > 31 days ⇒ reject | Preserved as the engine entry point; upgraded to delegate to the V2 resolver when flagged; FY label defect (calendar year only) fixed |
| E10 | Phase 4 engine | Journal persistence stores `accountingPeriodId`, `financialYearLabel`, `postingDate` (transaction date preserved in `entryDate`) | V2 resolver returns canonical period id + FY code into the same columns — no schema change to journals |
| E11 | Phase 4 | Adjustment journal framework (category, reason, related journal) exists | Closed-period corrections use it (treatments B/C in §41); reporting engine never posts |
| E12 | Phase 5 ledger | Canonical journal source (posted-only, mirror exclusion, authority rules); GL summary by arbitrary date windows | Close checks and period reports reuse these services; period boundaries feed the same windows |
| E13 | Phase 6 repair | Wrong-period corrections are repair actions with evidence and approval; exception register holds unresolved period anomalies | Reopening/adjustment flows route historical corrections through the repair framework; open exceptions block or warn at close |
| E14 | Phase 6 | Historical anomaly registry rows carry `accountingPeriodId`/`financialYearLabel` | Close checklist queries open anomalies for the period |
| E15 | Phase 7 | Trial Balance statuses (BALANCED / BALANCED_WITH_WARNINGS / UNBALANCED / BLOCKED) with exact differences | Close checklist gates on TB status; UNBALANCED blocks ordinary closure |
| E16 | Phase 7 | `runReportReconciliation` cross-checks TB/IS/BS/CF/Equity/AR/AP | Automated close checks call it; failures block or warn per severity |
| E17 | Phase 7 | Immutable versioned report snapshots with supersession + reasons (`AcctV2ReportSnapshotV2`) | Period close snapshots statements via `snapshotReport`; reopening supersedes without deleting |
| E18 | Phase 7 | Report runs record review/approve workflow with separation of duties | Close pack references run/snapshot ids; same audit pattern for close runs |
| E19 | Phase 7 PHASE_8_READINESS | Engine accepts arbitrary windows; `financialYearId`/`accountingPeriodId` already on the report request contract | Period close passes canonical period boundaries to report generation |
| E20 | Phase 1 security audit | Role-name authorization on period routes; no separation of duties | Permission-key authorization (`accountingPeriods.*`), preparer ≠ approver enforcement |
| E21 | Phase 1 | MK1,000,000 owner-capital duplication and other historical anomalies affect specific periods | Readiness assessment surfaces open exceptions per period; closure requires resolution or formal acceptance |

No new prior-phase findings were invented; each row traces to the referenced
phase documentation.
