# Phase 10 Tasks — Bank Reconciliation

Status legend: `DONE` | `IN_PROGRESS` | `PENDING` | `N/A`

## A — Documentation

| ID | Task | Status |
|---|---|---|
| A1 | PHASE_1_TO_9_EVIDENCE_INDEX.md | DONE |
| A2 | CURRENT_BANK_RECONCILIATION_ARCHITECTURE.md | DONE |
| A3 | BANK_RECONCILIATION_DATA_FLOW_MAP.md | DONE |
| A4 | PHASE_10_TASKS.md (this file) | DONE |
| A5 | TARGET_BANK_RECONCILIATION_ARCHITECTURE.md | DONE |
| A6 | STATEMENT_IMPORT_DESIGN.md | DONE |
| A7 | MATCHING_ENGINE_DESIGN.md | DONE |
| A8 | COMPLETION_AND_SNAPSHOT_DESIGN.md | DONE |
| A9 | LEGACY_RECONCILIATION_MIGRATION_STRATEGY.md | DONE |
| A10 | ROLLBACK_STRATEGY.md | DONE |
| A11 | PHASE_12_READINESS.md | DONE |
| A12 | FINAL_PHASE_10_REPORT.md | DONE |

## B — Database

| ID | Task | Status |
|---|---|---|
| B1 | Additive Prisma models (config/import/match/recon/snapshot) | DONE |
| B2 | Migration SQL | DONE |
| B3 | Indexes (tenant, account, date, amount, status) | DONE |
| B4 | Feature flag keys registered | DONE |

## C — Domain & application

| ID | Task | Status |
|---|---|---|
| C1 | Config validation (PaymentAccount + CoA) | DONE |
| C2 | File security | DONE |
| C3 | CSV / XLSX / OFX parsers | DONE |
| C4 | Import idempotency + duplicates + balance validation | DONE |
| C5 | GL candidate service | DONE |
| C6 | Matching rules + confidence + match types | DONE |
| C7 | Adjustments via Posting Engine | DONE |
| C8 | Outstanding / DIT + calculation | DONE |
| C9 | Approve / complete / snapshot / reopen | DONE |
| C10 | Period-close live feed | DONE |
| C11 | Multi-currency signed amounts | DONE |

## D — APIs & permissions

| ID | Task | Status |
|---|---|---|
| D1 | `/api/bank-reconciliation/**` routes | DONE |
| D2 | `bankReconciliation.*` permission matrix | DONE |
| D3 | Separation of duties on complete | DONE |

## E — UI

| ID | Task | Status |
|---|---|---|
| E1 | Sidebar Banking / Bank Reconciliation | DONE |
| E2 | Account picker + recon workspace | DONE |
| E3 | Import wizard | DONE |
| E4 | Matching workspace | DONE |
| E5 | Summary / history | DONE |

## F — Reports / observability

| ID | Task | Status |
|---|---|---|
| F1 | Reconciliation statement export (CSV/JSON) | DONE |
| F2 | Structured logs for import/match/complete | DONE |

## G — Tests & readiness

| ID | Task | Status |
|---|---|---|
| G1 | Unit/integration tests under `test/bankReconciliation*.test.js` | DONE |
| G2 | `artifacts/bank-reconciliation/bank-account-readiness.csv` | DONE |
| G3 | Pilot checklist in FINAL report | DONE |
