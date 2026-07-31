# Phase 18 — Production Migration & Cutover

InsightBooks V2 **production cutover framework**: governance, inventories, migration plans, reconciliation templates, acceptance records, and operational handover. **Actual cutover has NOT been executed** — this folder delivers documentation, runtime scaffolding, and runbook templates only.

| Field | Value |
|---|---|
| Phase | 18 — Production cutover |
| Document status | **DRAFT** |
| Cutover execution | **NOT EXECUTED** |
| Branch | `v2` |
| Latest Prisma migration | `20260721200000_security_governance_v2` (~109 folders) |
| Last updated | July 2026 |

---

## Status summary

| Item | Status |
|---|---|
| Cutover execution | **NOT EXECUTED** |
| Documentation scaffold | **DELIVERED** (114 files in this folder) |
| Runtime module | **IN PROGRESS** — `lib/productionCutover/`, `/api/system/cutover/*`, `scripts/cutover-*.cjs`, maintenance-mode enforcement |
| Phase 16 QA | Scaffolding **green** (`test/qa/**`); full `npm test` / rehearsal sign-off **PARTIAL / UNKNOWN** |
| Phase 17 capacity | **NOT CERTIFIED** — `docs/performance-reliability/CAPACITY_CERTIFICATION.md` |
| Production environment facts | **UNKNOWN** from developer workspace (no production SSH) |
| Scope freeze | **DRAFT — not approved until rehearsal** |
| Go-live decision | **NOT DECIDED** |

---

## Non-negotiable rules

1. **Do not invent** production hostnames, backup IDs, migration run IDs, row counts, financial totals, or go-live dates as if cutover already happened.
2. All inventory and control-total documents include **TO FILL FROM PRODUCTION** sections.
3. Migration scope freeze remains **DRAFT** until rehearsal sign-off (`MIGRATION_SCOPE_FREEZE.md`).
4. Financial reconciliation evidence is captured only after controlled execution on production copies.

---

## Document map

| Track | Start here |
|---|---|
| Evidence & prerequisites | `PHASE_1_TO_17_EVIDENCE_INDEX.md` |
| Implementation plan | `PHASE_18_TASKS.md` |
| Environment (template) | `PRODUCTION_ENVIRONMENT_INVENTORY.md`, `PRODUCTION_DATA_FLOW_MAP.md`, `PRODUCTION_DEPENDENCY_MAP.md` |
| Governance & scope | `MIGRATION_GOVERNANCE.md`, `MIGRATION_SCOPE_FREEZE.md`, `RISK_REGISTER.md` |
| Data inventory & manifest | `PRODUCTION_DATA_INVENTORY.md`, `DATA_DOMAIN_CLASSIFICATION.md`, `MIGRATION_MANIFEST.md`, `LEGACY_ID_MAPPING.md` |
| Diagnostics & controls | `PRE_MIGRATION_DIAGNOSTIC_REPORT.md`, `FINANCIAL_CONTROL_TOTALS.md`, `SECURITY_CONTROL_TOTALS.md`, `DOCUMENT_CONTROL_TOTALS.md` |
| Backup & rehearsal | `PRODUCTION_BACKUP_PLAN.md`, `BACKUP_RESTORE_VERIFICATION.md`, `FINAL_MIGRATION_REHEARSAL_REPORT.md` (**PENDING**) |
| Cutover execution | `CUTOVER_STRATEGY.md`, `CUTOVER_WINDOW_PLAN.md`, `MAINTENANCE_MODE.md`, `LEGACY_WRITE_FREEZE.md`, `DELTA_MIGRATION_STRATEGY.md` |
| Schema & domain migration | `SCHEMA_MIGRATION_PLAN.md`, `JOURNAL_MIGRATION.md`, `GENERAL_LEDGER_REBUILD.md`, domain `*_MIGRATION.md` stubs |
| Financial validation | `POST_MIGRATION_FINANCIAL_RECONCILIATION.md`, `TRIAL_BALANCE_RECONCILIATION.md`, `KNOWN_DEFECT_PRODUCTION_VALIDATION.md` |
| Safety | `STOP_CONDITIONS.md`, `ROLLBACK_STRATEGY.md`, `FORWARD_RECOVERY_STRATEGY.md`, `ROLLBACK_DECISION_FRAMEWORK.md` |
| Acceptance & decision | `FINANCE_ACCEPTANCE.md`, `SECURITY_ACCEPTANCE.md`, `TECHNICAL_ACCEPTANCE.md`, `BUSINESS_ACCEPTANCE.md`, `GO_LIVE_DECISION.md`, `FINAL_PRODUCTION_ACCEPTANCE.md` (unsigned) |
| Hypercare & handover | `HYPERCARE_PLAN.md`, `OPERATIONAL_HANDOVER.md`, `COMMUNICATION_PLAN.md`, `LEGACY_ARCHIVAL_PLAN.md` |
| Closure | `FINAL_PHASE_18_REPORT.md` |

---

## Existing deploy tooling (workspace)

| Asset | Path |
|---|---|
| Deploy | `deploy.sh`, `deploy-to-production.sh` |
| Safe deploy + migrate | `scripts/safe-deploy-production.sh` |
| Backup | `scripts/backup-database.sh` |
| PM2 process name (documented) | `insight-books` |

---

## Cross-phase readiness

| Track | Document |
|---|---|
| QA / release certification | `docs/quality-assurance/PHASE_18_READINESS.md` |
| Performance handoff | `docs/performance-reliability/PHASE_18_READINESS.md` |
| Migration rehearsal runbook | `docs/quality-assurance/MIGRATION_REHEARSAL_RUNBOOK.md` |
| Release certification process | `docs/quality-assurance/RELEASE_CERTIFICATION_PROCESS.md` |

---

## Runtime (parallel delivery)

| Component | Location | Status |
|---|---|---|
| Cutover domain/services | `lib/productionCutover/` | Scaffolding |
| Cutover APIs | `app/api/system/cutover/*` | Scaffolding |
| CLI scripts | `scripts/cutover-*.cjs` | Scaffolding |
| Maintenance mode | Server middleware + cutover flags | Scaffolding |

Diagnostic template: `PRE_MIGRATION_DIAGNOSTIC_REPORT.md` ← `scripts/cutover-pre-migration-diagnostic.cjs` (when deployed).

---

## Honest closure statement

Phase 18 **framework delivery** can complete while **production execution remains blocked** on Phase 16/17/15 gates, rehearsal sign-off, capacity certification, and signed acceptance templates. Roadmap formal closure is **CONDITIONAL** on future sign-offs — see `FINAL_PHASE_18_REPORT.md`.
