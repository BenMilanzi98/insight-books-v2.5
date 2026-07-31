# Executive Summary — Phase 1 Accounting Forensic Audit

**Scope**: full repository + local database (QA-scale copy; production not touched).
**Outcome**: every reported symptom now has a proven or strongly evidenced mechanism, a
read-only audit engine reproduces the checks on demand, and a prioritized Phase 2 backlog
exists. No accounting data was modified.

## The architecture in one paragraph

InsightBooks runs **two journal ledgers side by side** — the modern `Transaction`/
`TransactionLine` ledger written by the central engine (`postGlEntry`), and the legacy
`JournalEntry`/`JournalEntryLine` ledger still written by manual journals and several purchase/
liability paths — plus **three stored-balance caches** (`Account.balance`, `AccountBalance`,
`TenantSettings.ownerContributedCapital`) maintained incrementally with float arithmetic and no
serialization. Reports are split: core statements (P&L, Balance Sheet, Trial Balance) are
GL-pure, but dashboards, AR/AP aging, multi-tenant cash flow and several analytics endpoints
read operational tables or stored balances directly.

## Root causes of the reported symptoms

| Symptom | Proven mechanism |
|---|---|
| Capital MK1,000,000 shows MK2,000,000 | Legacy **header-amount `JournalEntry` rows** (amounts on the header, no lines) counted alongside line-based journals in balance rebuilds; plus a parallel `ownerContributedCapital` settings counter that summaries prefer — two independent double-count surfaces (CAP-005, JRN-009; trace in `CAPITAL_AND_EQUITY_AUDIT.md`) |
| Liabilities in CoA but not in Journal Entries | Stored `Account.balance` written directly (legacy `updateAccountBalance`, backfills, header journals) while the Journal Entries screen lists only line-based entries; CoA display falls back to `legacy_account_balance` when no posted GL exists (AP-004 trace in `PAYABLES_AUDIT.md`) |
| Trial Balance doesn't balance | On this dataset TB balances; production-risk ranking: unbalanced single-line tax journals (supplier payment path), header-amount journals, dual-ledger merges, parent+child inclusion (TB module does not skip group headers) — `TRIAL_BALANCE_FORENSIC_REPORT.md` |
| Duplicate postings | 11 engine-bypass paths + wrong-table idempotency (invoice Draft→issued checks `JournalEntry`, engine writes `Transaction`), shared COGS source keys, unstable payment reference keys, payroll dual path, TOCTOU in app-level duplicate check — `DUPLICATE_POSTING_ANALYSIS.md`, `ACCOUNTING_POSTING_MATRIX.md` |
| Reports disagree with GL | AR/AP aging fully operational; dashboards fall back to operational basis silently; multi-tenant cash flow operational; financial ratios mislabel operational output as `general_ledger` — `FINANCIAL_REPORT_LINEAGE.md` |
| Period locks not enforced | `assertPeriodOpen` is correct but fail-open (zero periods → allow; unexpected error → allow); manual journals and several reversal branches check only "closed", allowing posting into period gaps — `ACCOUNTING_PERIODS_AUDIT.md` |

## Security highlights (new, verified)

- **`postGlEntry` never checks that line accounts belong to the posting tenant** (SEC-1).
- **Supplier financial APIs accept `tenantId` from the query string with no auth** — IDOR (SEC-2).
- Reversal endpoint and capital routes have no RBAC beyond a session (SEC-3/4).

## Findings count (audit engine, latest run on local data)

15 findings: 8 critical, 5 high, 2 medium — dominated by AR control-account divergence
(−15,000), legacy header journals, stored-balance drift, and missing source journals.
Structural (code-level) findings are catalogued separately in the risk register (R-01..R-25).

## What Phase 2 should do first

1. **P0-5** Close the tenant-isolation holes (small, independent, highest urgency).
2. **P0-1** Decide the single-ledger strategy and freeze legacy `JournalEntry` writers.
3. **P0-6** Consolidate all 11 engine-bypass posting paths through `postGlEntry`.
4. **P0-2/P0-3** DB-level idempotency (unique posted-source key) and balanced-journal constraints.
5. Then data repair (header journals, stored-balance rebuild) with journaled, reversible migrations.

Full sequencing and evidence: `PHASE_2_REMEDIATION_BACKLOG.md`, `RISK_REGISTER.md`,
`FINAL_PHASE_1_REPORT.md`.
