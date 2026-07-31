# Phase 1–10 Evidence Index (Equity Management Prerequisites)

Evidence paths only — no invented findings.

## Phase 1 — Forensic audit

| Finding / topic | Path | Phase 11 requirement |
|---|---|---|
| Capital & equity audit | [`docs/accounting-audit/CAPITAL_AND_EQUITY_AUDIT.md`](../accounting-audit/CAPITAL_AND_EQUITY_AUDIT.md) | Owner capital vs stored balances; dual-count risks |
| Duplicate posting analysis | [`docs/accounting-audit/DUPLICATE_POSTING_ANALYSIS.md`](../accounting-audit/DUPLICATE_POSTING_ANALYSIS.md) | Idempotent capital events; MK1,000,000 once |
| Journal integrity | [`docs/accounting-audit/JOURNAL_INTEGRITY_REPORT.md`](../accounting-audit/JOURNAL_INTEGRITY_REPORT.md) | Immutable JE authority |
| GL audit | [`docs/accounting-audit/GENERAL_LEDGER_AUDIT.md`](../accounting-audit/GENERAL_LEDGER_AUDIT.md) | Equity from JE lines |
| Report lineage | [`docs/accounting-audit/FINANCIAL_REPORT_LINEAGE.md`](../accounting-audit/FINANCIAL_REPORT_LINEAGE.md) | SOCE / BS equity |
| Multi-tenant / security | [`docs/accounting-audit/MULTI_TENANT_AND_SECURITY_AUDIT.md`](../accounting-audit/MULTI_TENANT_AND_SECURITY_AUDIT.md) | Business-scoped owners |
| Final Phase 1 | [`docs/accounting-audit/FINAL_PHASE_1_REPORT.md`](../accounting-audit/FINAL_PHASE_1_REPORT.md) | Baseline |

## Phase 2–4 — Architecture & posting

| Topic | Path |
|---|---|
| Target architecture | [`docs/accounting-architecture/TARGET_ACCOUNTING_ARCHITECTURE.md`](../accounting-architecture/TARGET_ACCOUNTING_ARCHITECTURE.md) |
| Domain / events | [`docs/accounting-architecture/ACCOUNTING_DOMAIN_MODEL.md`](../accounting-architecture/ACCOUNTING_DOMAIN_MODEL.md), [`ACCOUNTING_EVENT_CATALOGUE.md`](../accounting-architecture/ACCOUNTING_EVENT_CATALOGUE.md) |
| Idempotency / boundaries | [`IDEMPOTENCY_DESIGN.md`](../accounting-architecture/IDEMPOTENCY_DESIGN.md), [`TRANSACTION_BOUNDARY.md`](../accounting-architecture/TRANSACTION_BOUNDARY.md) |
| Feature flags | [`FEATURE_FLAG_STRATEGY.md`](../accounting-architecture/FEATURE_FLAG_STRATEGY.md) |
| Equity CoA purposes | [`lib/coaV2/domain/systemPurposes.js`](../../lib/coaV2/domain/systemPurposes.js) — OWNER_CAPITAL, SHARE_CAPITAL, OWNER_DRAWINGS, DIVIDENDS_PAYABLE, RETAINED_EARNINGS |
| Templates | [`lib/accountingV2/templates/definitions.js`](../../lib/accountingV2/templates/definitions.js) — CAPITAL_CONTRIBUTION, OWNER_DRAWING, DIVIDEND_* |
| Events | [`lib/accountingV2/domain/enums.js`](../../lib/accountingV2/domain/enums.js) — CAPITAL_CONTRIBUTION_POSTED, OWNER_DRAWING_POSTED, DIVIDEND_DECLARED, DIVIDEND_PAID |

## Phase 5–7 — Ledger & reports

| Topic | Path |
|---|---|
| Canonical JE | [`lib/accountingV2/ledger/canonicalJournalSource.js`](../../lib/accountingV2/ledger/canonicalJournalSource.js) |
| Owner-capital repair | [`docs/accounting-repair/OWNER_CAPITAL_DISCREPANCY_REPAIR.md`](../accounting-repair/OWNER_CAPITAL_DISCREPANCY_REPAIR.md) |
| Equity reconciliation (repair) | [`docs/accounting-repair/EQUITY_RECONCILIATION.md`](../accounting-repair/EQUITY_RECONCILIATION.md) |
| SOCE | [`docs/accounting-reports/STATEMENT_OF_CHANGES_IN_EQUITY.md`](../accounting-reports/STATEMENT_OF_CHANGES_IN_EQUITY.md) |
| Equity reporting | [`docs/accounting-reports/EQUITY_REPORTING.md`](../accounting-reports/EQUITY_REPORTING.md) |
| Report service | [`lib/accountingV2/reporting/financialStatementService.js`](../../lib/accountingV2/reporting/financialStatementService.js) |

## Phase 8–10

| Topic | Path |
|---|---|
| Period close / year-end readiness | [`docs/accounting-periods/PHASE_9_READINESS.md`](../accounting-periods/PHASE_9_READINESS.md) |
| Phase 9 equity adapters | [`docs/accounting-integrations/FINAL_PHASE_9_REPORT.md`](../accounting-integrations/FINAL_PHASE_9_REPORT.md), [`remainingAdapters.js`](../../lib/accountingV2/adapters/remainingAdapters.js) |
| Phase 10/11/12 readiness | [`docs/accounting-integrations/PHASE_10_11_12_READINESS.md`](../accounting-integrations/PHASE_10_11_12_READINESS.md) — Phase 11 was **not started** |
| Bank recon (capital deposit matching support) | [`docs/bank-reconciliation/FINAL_PHASE_10_REPORT.md`](../bank-reconciliation/FINAL_PHASE_10_REPORT.md) |

## Operational surface that exists today

| Capability | Path | Status |
|---|---|---|
| Capital Account UI/API | `app/capital-account/**`, `app/api/capital-account/**` | Live contributions |
| Legacy EquityAccount model | `prisma/schema.prisma` `EquityAccount` | Sparse; balances not GL authority |
| TenantSettings.ownerContributedCapital | schema | Parallel counter — dual-count risk |
| Drawing / dividend adapters | `remainingAdapters.js` / scaffolds | Drawing exported unused; dividends scaffold |

## Remaining uncertainty (documented, not invented)

- Exact historical MK1,000,000 event identity must be verified per tenant during migration readiness, not assumed globally.
- Legal share-class rules beyond nominal/premium split require governance approval per business.
