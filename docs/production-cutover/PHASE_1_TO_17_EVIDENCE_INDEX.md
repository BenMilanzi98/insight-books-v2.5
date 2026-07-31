# Phases 1–17 — Evidence Index for Production Cutover

Cross-phase index of **existing documentation** consumed before production cutover. Missing entries marked **NOT FOUND** — no invented finding IDs, row counts, or execution results.

| Field | Value |
|---|---|
| Phase | 18 — Production cutover |
| Document status | **DRAFT** |
| Cutover execution | **NOT EXECUTED** |
| Branch | `v2` |
| Latest Prisma migration | `20260721200000_security_governance_v2` (~109 folders) |
| Last updated | July 2026 |

---

## Phase 1 — Accounting forensic audit

| Document | Path | Status |
|---|---|---|
| Final report | `docs/accounting-audit/FINAL_PHASE_1_REPORT.md` | Found |
| GL audit | `docs/accounting-audit/GENERAL_LEDGER_AUDIT.md` | Found |
| Trial balance forensic | `docs/accounting-audit/TRIAL_BALANCE_FORENSIC_REPORT.md` | Found |
| Multi-tenant security audit | `docs/accounting-audit/MULTI_TENANT_AND_SECURITY_AUDIT.md` | Found |
| Production data findings (live) | — | **NOT FOUND** |

---

## Phase 2 — Accounting architecture

| Document | Path | Status |
|---|---|---|
| Final report | `docs/accounting-architecture/FINAL_PHASE_2_REPORT.md` | Found |
| Target architecture | `docs/accounting-architecture/TARGET_ACCOUNTING_ARCHITECTURE.md` | Found |
| Cutover strategy | `docs/accounting-architecture/ACCOUNTING_CUTOVER_STRATEGY.md` | Found |
| Transaction boundary | `docs/accounting-architecture/TRANSACTION_BOUNDARY.md` | Found |

---

## Phases 3–7 — CoA through reports

| Phase | Final report | Key evidence | Status |
|---|---|---|---|
| 3 CoA | `docs/accounting-coa/FINAL_PHASE_3_REPORT.md` | `EXISTING_BUSINESS_READINESS.md` | Found |
| 4 Posting | `docs/accounting-posting-engine/FINAL_PHASE_4_REPORT.md` | `TRANSACTIONAL_OUTBOX.md`, `POSTING_ENGINE_MIGRATION_STRATEGY.md` | Found |
| 5 Ledger | `docs/accounting-ledger/FINAL_PHASE_5_REPORT.md` | `GENERAL_LEDGER_REBUILD.md` (module) | Found |
| 6 Repair | `docs/accounting-repair/FINAL_PHASE_6_REPORT.md` | `HISTORICAL_ANOMALY_REGISTRY.md` | Found |
| 7 Reports | `docs/accounting-reports/FINAL_PHASE_7_REPORT.md` | `MIGRATION_VALIDATION.md` | Found |

---

## Phases 8–14 — Periods through loan readiness

| Phase | Final report | Status |
|---|---|---|
| 8 Periods | `docs/accounting-periods/FINAL_PHASE_8_REPORT.md` | Found |
| 9 Integrations | `docs/accounting-integrations/FINAL_PHASE_9_REPORT.md` | Found |
| 10 Bank recon | `docs/bank-reconciliation/FINAL_PHASE_10_REPORT.md` | Found |
| 11 Equity | `docs/equity-management/FINAL_PHASE_11_REPORT.md` | Found |
| 12 Close | `docs/accounting-close/FINAL_PHASE_12_REPORT.md` | Found |
| 13 Planning | `docs/financial-planning/FINAL_PHASE_13_REPORT.md` | Found |
| 14 Loan readiness | `docs/loan-readiness/FINAL_PHASE_14_REPORT.md` | Found |

Sample readiness CSVs under `artifacts/` exist for several modules — **not production extracts**.

---

## Phase 15 — Security governance

| Document | Path | Status |
|---|---|---|
| Final report | `docs/security-governance/FINAL_PHASE_15_REPORT.md` | Found |
| Evidence index | `docs/security-governance/PHASE_1_TO_14_EVIDENCE_INDEX.md` | Found |
| Rollback strategy | `docs/security-governance/ROLLBACK_STRATEGY.md` | Found |
| Phase 15 exit on production | — | **NOT MET** (per QA Phase 18 readiness) |

---

## Phase 16 — Quality assurance

| Document | Path | Status |
|---|---|---|
| Final report | `docs/quality-assurance/FINAL_PHASE_16_REPORT.md` | Found |
| Test evidence index | `docs/quality-assurance/PHASE_1_TO_15_TEST_EVIDENCE_INDEX.md` | Found |
| Migration rehearsal runbook | `docs/quality-assurance/MIGRATION_REHEARSAL_RUNBOOK.md` | Found |
| Release certification | `docs/quality-assurance/RELEASE_CERTIFICATION_PROCESS.md` | Found |
| `test/qa/**` scaffolding | Executable | **GREEN** |
| Full `npm test` zero failures | CI | **PARTIAL / UNKNOWN** |
| Staging rehearsal ×2 sign-off | `artifacts/quality-assurance/rehearsal-*-signoff.md` | **NOT FOUND** |

---

## Phase 17 — Performance & reliability

| Document | Path | Status |
|---|---|---|
| Final report | `docs/performance-reliability/FINAL_PHASE_17_REPORT.md` | Found |
| Evidence index | `docs/performance-reliability/PHASE_1_TO_16_EVIDENCE_INDEX.md` | Found |
| Capacity certification | `docs/performance-reliability/CAPACITY_CERTIFICATION.md` | Found — **NOT CERTIFIED** |
| Baseline performance | `docs/performance-reliability/BASELINE_PERFORMANCE_REPORT.md` | **NOT MET** |
| Timed DR restore | `docs/performance-reliability/RECOVERY_OBJECTIVES.md` | **NOT MET** |

---

## Cutover gate summary

| Gate | Status |
|---|---|
| Phase 16 QA scaffolding | **GREEN** |
| Phase 16 full certification | **PARTIAL / UNKNOWN** |
| Phase 17 capacity | **NOT CERTIFIED** |
| Production inventory complete | **NOT STARTED** (templates in `docs/production-cutover/`) |
| Migration rehearsal report | **PENDING** |
| Cutover executed | **NOT EXECUTED** |
