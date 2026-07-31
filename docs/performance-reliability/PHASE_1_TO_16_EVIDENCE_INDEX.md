# Phases 1–16 — Performance & Reliability Evidence Index

Cross-phase index of **existing documentation** under `docs/` relevant to performance, reliability, and operational readiness. Missing entries marked **NOT FOUND** — no invented finding IDs.

---

## Phase 1 — Accounting forensic audit

| Document | Path | Status |
|---|---|---|
| Final report | `docs/accounting-audit/FINAL_PHASE_1_REPORT.md` | Found |
| Audit rule catalogue | `docs/accounting-audit/AUDIT_RULE_CATALOGUE.md` | Found |
| GL audit | `docs/accounting-audit/GENERAL_LEDGER_AUDIT.md` | Found |
| Performance-specific audit | — | **NOT FOUND** |

---

## Phase 2 — Accounting architecture

| Document | Path | Status |
|---|---|---|
| Final report | `docs/accounting-architecture/FINAL_PHASE_2_REPORT.md` | Found |
| Database foundation | `docs/accounting-architecture/DATABASE_FOUNDATION.md` | Found |
| Transaction boundary | `docs/accounting-architecture/TRANSACTION_BOUNDARY.md` | Found |
| Risk register (P2-06 outbox) | `docs/accounting-architecture/RISK_REGISTER.md` | Found |
| Architecture decisions (outbox ADR) | `docs/accounting-architecture/ARCHITECTURE_DECISIONS.md` | Found |

---

## Phase 3 — Chart of Accounts V2

| Document | Path | Status |
|---|---|---|
| Final report | `docs/accounting-coa/FINAL_PHASE_3_REPORT.md` | Found |
| Evidence index | `docs/accounting-coa/PHASE_1_AND_2_EVIDENCE_INDEX.md` | Found |
| Performance validation | — | **NOT FOUND** |

---

## Phase 4 — Posting engine

| Document | Path | Status |
|---|---|---|
| Final report | `docs/accounting-posting-engine/FINAL_PHASE_4_REPORT.md` | Found |
| Evidence index | `docs/accounting-posting-engine/PHASE_1_TO_3_EVIDENCE_INDEX.md` | Found |
| Transactional outbox | `docs/accounting-posting-engine/TRANSACTIONAL_OUTBOX.md` | Found |
| Error and retry architecture | `docs/accounting-posting-engine/ERROR_AND_RETRY_ARCHITECTURE.md` | Found |
| Observability guide | `docs/accounting-posting-engine/OBSERVABILITY_GUIDE.md` | Found |
| Atomic persistence | `docs/accounting-posting-engine/ATOMIC_PERSISTENCE.md` | Found |

---

## Phase 5 — Ledger V2

| Document | Path | Status |
|---|---|---|
| Final report | `docs/accounting-ledger/FINAL_PHASE_5_REPORT.md` | Found |
| Evidence index | `docs/accounting-ledger/PHASE_1_TO_4_EVIDENCE_INDEX.md` | Found |
| **Performance validation** | `docs/accounting-ledger/PERFORMANCE_VALIDATION.md` | Found |
| Journal integrity rules | `docs/accounting-ledger/JOURNAL_AND_LEDGER_INTEGRITY_RULES.md` | Found |
| Canonical journal model | `docs/accounting-ledger/CANONICAL_JOURNAL_MODEL.md` | Found |

---

## Phase 6 — Repair

| Document | Path | Status |
|---|---|---|
| Final report | `docs/accounting-repair/FINAL_PHASE_6_REPORT.md` | Found |
| Evidence index | `docs/accounting-repair/PHASE_1_TO_5_EVIDENCE_INDEX.md` | Found |
| Observability guide | `docs/accounting-repair/OBSERVABILITY_GUIDE.md` | Found |

---

## Phase 7 — Accounting reports

| Document | Path | Status |
|---|---|---|
| Final report | `docs/accounting-reports/FINAL_PHASE_7_REPORT.md` | Found |
| Evidence index | `docs/accounting-reports/PHASE_1_TO_6_EVIDENCE_INDEX.md` | Found |
| **Report cache** | `docs/accounting-reports/REPORT_CACHE.md` | Found |
| Current reporting architecture | `docs/accounting-reports/CURRENT_REPORTING_ARCHITECTURE.md` | Found |
| Financial reporting engine | `docs/accounting-reports/FINANCIAL_REPORTING_ENGINE.md` | Found |

---

## Phase 8–9 — Integrations & periods

| Document | Path | Status |
|---|---|---|
| Integrations final | `docs/accounting-integrations/FINAL_PHASE_9_REPORT.md` | Found |
| Integrations evidence | `docs/accounting-integrations/PHASE_1_TO_8_EVIDENCE_INDEX.md` | Found |
| Periods final | `docs/accounting-periods/FINAL_PHASE_8_REPORT.md` | Found |
| Periods evidence | `docs/accounting-periods/PHASE_1_TO_7_EVIDENCE_INDEX.md` | Found |
| Period notifications (outbox) | `docs/accounting-periods/NOTIFICATIONS.md` | Found |

---

## Phase 10 — Bank reconciliation

| Document | Path | Status |
|---|---|---|
| Final report | `docs/bank-reconciliation/FINAL_PHASE_10_REPORT.md` | Found |
| Evidence index | `docs/bank-reconciliation/PHASE_1_TO_9_EVIDENCE_INDEX.md` | Found |

---

## Phase 11–12 — Equity & accounting close

| Document | Path | Status |
|---|---|---|
| Equity final | `docs/equity-management/FINAL_PHASE_11_REPORT.md` | Found |
| Equity evidence | `docs/equity-management/PHASE_1_TO_10_EVIDENCE_INDEX.md` | Found |
| Close final | `docs/accounting-close/FINAL_PHASE_12_REPORT.md` | Found |
| Close evidence | `docs/accounting-close/PHASE_1_TO_11_EVIDENCE_INDEX.md` | Found |

---

## Phase 13–14 — Financial planning & loan readiness

| Document | Path | Status |
|---|---|---|
| Planning final | `docs/financial-planning/FINAL_PHASE_13_REPORT.md` | Found |
| Planning evidence | `docs/financial-planning/PHASE_1_TO_12_EVIDENCE_INDEX.md` | Found |
| Loan readiness final | `docs/loan-readiness/FINAL_PHASE_14_REPORT.md` | Found |
| Loan evidence | `docs/loan-readiness/PHASE_1_TO_13_EVIDENCE_INDEX.md` | Found |

---

## Phase 15 — Security governance

| Document | Path | Status |
|---|---|---|
| Final report | `docs/security-governance/FINAL_PHASE_15_REPORT.md` | Found |
| Evidence index | `docs/security-governance/PHASE_1_TO_14_EVIDENCE_INDEX.md` | Found |
| Rate limiting (in-memory) | Code: `lib/securityGovernance/domain/rateLimit.js` | Found (code) |

---

## Phase 16 — Quality assurance

| Document | Path | Status |
|---|---|---|
| Final report | `docs/quality-assurance/FINAL_PHASE_16_REPORT.md` | Found |
| Test evidence index | `docs/quality-assurance/PHASE_1_TO_15_TEST_EVIDENCE_INDEX.md` | Found |
| Failure injection tests | `test/qa/failure-injection/failureInjection.test.js` | Found (code) |
| Phase 17 QA readiness | `docs/quality-assurance/PHASE_17_READINESS.md` | Found |
| Load/soak test results | — | **NOT FOUND** |

---

## Platform / deployment (cross-cutting)

| Document | Path | Status |
|---|---|---|
| Docker setup | `docs/DOCKER_SETUP.md` | Found |
| Docker restore | `docs/DOCKER_RESTORE_SOLUTION.md` | Found |
| Production deployment | `docs/PRODUCTION_DEPLOYMENT_GUIDE.md` | Found |
| Quick deployment reference | `docs/QUICK_DEPLOYMENT_REFERENCE.md` | Found (PM2) |
| Regression testing | `docs/REGRESSION_TESTING_GUIDE.md` | Found |
| Baseline latency report | — | **NOT FOUND** (Phase 17 pending) |
| k6 / autocannon scripts | — | **NOT FOUND** |

---

## Integrity audit hooks (runtime)

| Check | Location |
|---|---|
| ARCH-005 outbox backlog | `lib/accountingAudit/architectureIntegrityAudit.js` |

---

## How to use this index

1. Trace a bottleneck in [PERFORMANCE_BOTTLENECK_REGISTER.md](./PERFORMANCE_BOTTLENECK_REGISTER.md) back to the originating phase doc.
2. Use Phase 5 [PERFORMANCE_VALIDATION.md](../accounting-ledger/PERFORMANCE_VALIDATION.md) and Phase 7 [REPORT_CACHE.md](../accounting-reports/REPORT_CACHE.md) as the primary **design-time** performance evidence before Phase 17 measurement.
