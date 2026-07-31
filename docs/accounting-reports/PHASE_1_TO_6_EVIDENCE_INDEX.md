# Phase 1–6 Evidence Index for Phase 7

Findings and binding decisions from prior phases that constrain the reporting
engine. Sources: `docs/accounting-audit/` (Phase 1), `docs/accounting-v2/`
(Phase 2/4/5 ADRs and reports), `docs/chart-of-accounts/` (Phase 3),
`docs/accounting-repair/` (Phase 6), plus the Phase 7 inspection in
`CURRENT_REPORTING_ARCHITECTURE.md`.

| # | Phase | Finding / decision | Reports affected | Phase 7 requirement | Rule |
|---|---|---|---|---|---|
| E1 | 1 | Report lineage audit: statements read operational tables and stored balances alongside journals | BS, P&L, CF, dashboards | Engine reads ONLY the canonical journal source | REP-031/032 |
| E2 | 1 | Trial Balance forensic: TB did not always balance; differences hidden by presentation | TB | Display exact difference; UNBALANCED status; never plug | REP-001 |
| E3 | 1 | Duplicate posting analysis: one source, multiple journals (races, import reruns) | all | Authority rules + Phase 6 registry; disclose LEGACY_V2 duplicates | REP-023 |
| E4 | 1 | Capital/equity audit: owner capital MK1M displayed as MK2M | BS, equity | Stored balances excluded; capital appears once; equity tests | REP-015/031 |
| E5 | 1 | Liabilities visible in CoA/reports with no journal support | BS | Unsupported balances excluded from canonical totals, disclosed as exceptions | REP-031 |
| E6 | 1 | Parent+child double counting in report rollups | TB, BS, P&L | Posting accounts carry amounts; parent rollups presentation-only | REP-013 |
| E7 | 2 | ADR: General Ledger is the single financial source of truth | all | All statements derive from GL query service | rule 2 |
| E8 | 2 | Feature-flag rollout architecture (server-controlled, per-tenant) | all | `FLAG`-style reportsV2 flags for controlled cutover | rollout |
| E9 | 3 | CoA V2 classification: `coaV2Category/SubType`, `financialStatementSection/Subsection`, `cashFlowClassification`, `systemPurpose`, `controlAccountPurpose`, `consolidationGroup`, normal balances | all | Report line mappings resolve from explicit CoA classification, not code ranges | REP-034/036 |
| E10 | 3 | Merged/deprecated accounts: posting stays on original row; reporting rolls up to survivor; deprecated remain reportable | all | Survivor rollup (Phase 5 does this); deprecated included | rule 10/19 |
| E11 | 3 | Salary Account 5200 canonical | P&L, payroll | Payroll reports read 5200 + payroll liability purposes | REP-010 |
| E12 | 4 | Journal statuses + immutability; drafts/failed/void never financial | all | Canonical source excludes them (verified by tests) | REP-018/019/020 |
| E13 | 4 | Shadow posting carries no financial effect | all | Shadow journals excluded (canonical source) | REP-021 |
| E14 | 5 | Canonical journal source authority rules; mirror JEs excluded; header-amount JEs excluded | all | Engine consumes `canonicalJournalSource` only | REP-023 |
| E15 | 5 | Ledger query service computes opening/movement/closing with normal-balance presentation; running balances fixed (P5-I04) | TB, GL | TB engine wraps `getBusinessLedgerSummary`; drill-down wraps `getAccountLedger` | REP-025 |
| E16 | 5 | Reversals: both original and reversal remain visible and net in totals | all | Rule 15/16 satisfied by source; tested | REP-022 |
| E17 | 6 | QA-Accounting tenant: 2 STORED_BALANCE_DIFFERENCE (equity 3102, account 1110), 2 header-only capital journals, 4 missing period links; all other tenants clean | TB, BS, equity | Exceptions surfaced on reports; VERIFIED blocked while material findings open for that business | REP-031, integrity status |
| E18 | 6 | Exception register queryable at `/api/accounting-v2/repair/exceptions`; open anomalies via registry | all | Reports disclose unresolved exceptions; integrity status consumes registry | rule 30 |
| E19 | 6 | No unsupported liability found in dev data; liabilities reconcile | BS | Liability lines journal-supported | REP-031 |
| E20 | 6 | Repair journals are `entryType: 'HistoricalRepair'`, prefix HREP- | all | Included in balances, identifiable in drill-down | drill-down |
| E21 | 7 insp. | Existing dual-stack defects C1–C12 | all | See `CURRENT_REPORTING_ARCHITECTURE.md` defect register | REP map |

No previous finding was invented; entries E1–E6 summarize the Phase 1 audit
documents, E7–E16 summarize binding architecture decisions verified in code,
E17–E20 are the measured Phase 6 results.
