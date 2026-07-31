# InsightBooks V2 — Phase 1 Accounting Forensic Audit

This folder contains the deliverables of **Phase 1: Complete Accounting Forensic Audit** of the
accounting-backend reimplementation programme. Phase 1 is strictly **read-only**: no accounting
data is repaired, deleted, reversed, or rewritten. The objective is to inspect, map, measure,
document, and expose every accounting defect **before** any repair.

## How to run the audit

```bash
# Full audit across all tenants (read-only)
npm run audit:forensic

# Scope to a single business
node scripts/accounting-forensic-audit.mjs --business <tenantId>

# Individual modules (comma-separated)
node scripts/accounting-forensic-audit.mjs --module journals,ledger,trial-balance,sources,coa,periods,reversals,capital,ar-ap

# Date range
node scripts/accounting-forensic-audit.mjs --from 2026-01-01 --to 2026-12-31

# Verbose console output
node scripts/accounting-forensic-audit.mjs --verbose
```

Artifacts (JSON + CSV) are written to `artifacts/accounting-audit/` which is **git-ignored**
because it may contain real financial data.

## Audit engine

The reusable read-only engine lives in `lib/accountingAudit/`:

| Module | File | What it detects |
|---|---|---|
| `journals` | `journalIntegrityAudit.js` | Unbalanced journals, no-line/one-line journals, both/neither debit-credit lines, negative amounts, missing posting dates, missing sources, duplicate posted sources, legacy header-amount journals (JRN-009) |
| `ledger` | `ledgerReconciliationAudit.js` | Stored `Account.balance` vs independent journal reconstruction, cross-tenant line references |
| `trial-balance` | `trialBalanceAudit.js` | Independent per-tenant trial balance from posted lines, parent/child double-count hazards |
| `sources` | `sourceLinkageAudit.js` | Operational records (sales, invoices, payments, expenses, supplier bills/payments) without posted GL journals |
| `coa` | `chartOfAccountsAudit.js` | Duplicate codes, purpose collisions (multiple salary/AR/AP/capital accounts), hierarchy cycles, parent-posting, inactive-account postings |
| `periods` | `periodsReversalsAudit.js` | Period overlaps/gaps, closed-period violations, transactions with no period coverage, unaudited reopenings |
| `reversals` | `periodsReversalsAudit.js` | Orphan reversals, amount mismatches, double reversals, cross-tenant reversals |
| `capital` | `capitalEquityAudit.js` | Equity account reconciliation with full per-source trace, duplicate capital postings, parent+child equity double counts, independent `EquityAccount` balances |
| `ar-ap` | `arApReconciliationAudit.js` | AR/AP control account vs operational subledger, internally inconsistent invoice balances, unsupported liability balances |

Every run records accounting table row counts **before and after** and fails loudly if they differ,
proving the audit performed no writes.

## Tests

```bash
npx vitest run test/accountingAudit.test.js
```

## Documents

| Document | Content |
|---|---|
| `PHASE_1_TASKS.md` | Workstream tracker with status and evidence |
| `EXECUTIVE_SUMMARY.md` | Findings for management |
| `CURRENT_ARCHITECTURE.md` | Actual system architecture (verified) |
| `REPOSITORY_ACCOUNTING_MAP.md` | Every file that reads/writes financial data |
| `DATABASE_SCHEMA_AUDIT.md` | Schema-level defects and risks |
| `ACCOUNTING_POSTING_MATRIX.md` | Every business event → actual posting implementation |
| `CHART_OF_ACCOUNTS_FORENSIC_REPORT.md` | CoA anomalies |
| `JOURNAL_INTEGRITY_REPORT.md` | Journal-level defects |
| `DUPLICATE_POSTING_ANALYSIS.md` | Duplicate-posting causes with evidence |
| `GENERAL_LEDGER_AUDIT.md` | GL reconstruction results |
| `RECEIVABLES_AUDIT.md` / `PAYABLES_AUDIT.md` | Control-account reconciliations |
| `ACCOUNTING_PERIODS_AUDIT.md` | Period control defects |
| `CAPITAL_AND_EQUITY_AUDIT.md` | Capital duplication trace (MK1M→MK2M class) |
| `TRIAL_BALANCE_FORENSIC_REPORT.md` | Independent TB vs module TB |
| `REVERSALS_AUDIT.md` | Reversal defects |
| `FINANCIAL_REPORT_LINEAGE.md` | Report → data source tracing |
| `MULTI_TENANT_AND_SECURITY_AUDIT.md` | Tenant isolation findings |
| `AUDIT_RULE_CATALOGUE.md` | All rule codes |
| `RISK_REGISTER.md` | Prioritized risks |
| `PHASE_2_REMEDIATION_BACKLOG.md` | Evidence-based repair backlog |
| `FINAL_PHASE_1_REPORT.md` | Answers to the 20 mandated questions |
