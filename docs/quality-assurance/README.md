# Phase 16 — Quality Assurance & Test Assurance



Compliance-grade test documentation for InsightBooks V2. **Evidence date:** July 2026. All counts and paths verified against the repository (`vitest.config.js`, `test/`, `.github/workflows/accounting-verify.yml`).



---



## Purpose



Phase 16 establishes the **test assurance layer** that gates Phase 15 security code, accounting V2 modules, and migration cutover. It does not replace module-specific audits (Phases 1–14); it **indexes, traces, and governs** automated verification.



| Theme | Deliverables in this folder |

|---|---|

| Current state | `CURRENT_TEST_ARCHITECTURE.md`, `PHASE_1_TO_15_TEST_EVIDENCE_INDEX.md` |

| Gaps & risk | `TEST_GAP_REGISTER.md`, `RISK_REGISTER.md`, `FLAKY_AND_SKIPPED_TEST_REGISTER.md` |

| Target state | `TARGET_TEST_ARCHITECTURE.md`, `TEST_COVERAGE_POLICY.md`, `CI_QUALITY_GATES.md` |

| Invariants | `ACCOUNTING_INVARIANT_CATALOGUE.md`, `SECURITY_INVARIANT_CATALOGUE.md` |

| Traceability | `REQUIREMENT_TEST_TRACEABILITY_MATRIX.md`, `DEFECT_REGRESSION_CATALOGUE.md` |

| Matrices | `POSTING_ENGINE_TEST_MATRIX.md`, `AUTHORIZATION_TEST_MATRIX.md`, `MULTI_TENANT_ISOLATION_MATRIX.md` |

| Migration | `MIGRATION_TEST_STRATEGY.md`, `MIGRATION_REHEARSAL_RUNBOOK.md` |

| Governance | `FLAKY_TEST_POLICY.md`, `TEST_WAIVER_GOVERNANCE.md`, `RELEASE_CERTIFICATION_PROCESS.md` |

| Planning | `PHASE_16_TASKS.md`, `PHASE_17_READINESS.md`, `PHASE_18_READINESS.md`, `FINAL_PHASE_16_REPORT.md` |

| Data & isolation | `TEST_DATA_ARCHITECTURE.md`, `SYNTHETIC_DATA_AND_PRIVACY.md`, `TEST_DATABASE_ENVIRONMENT.md`, `TEST_ISOLATION.md` |

| Engineering standards | `UNIT_TEST_STANDARDS.md`, `EXACT_DECIMAL_TESTING.md`, `TEST_FACTORIES_AND_BUILDERS.md`, `DETERMINISTIC_TIME_AND_IDENTIFIERS.md` |

| Golden & architecture | `GOLDEN_ACCOUNTING_DATASETS.md`, `STATIC_ARCHITECTURE_TESTS.md`, `PROPERTY_BASED_TESTING.md`, `MUTATION_TESTING.md` |



---



## Current test baseline (repo evidence)



| Metric | Value | Source |

|---|---|---|

| Runner | Vitest (`vitest run`) | `package.json` |

| Config | `environment: 'node'`, `include: ['test/**/*.test.js']` | `vitest.config.js` |

| Test files | **95+** | `test/**/*.test.js` glob |

| Test cases (full suite) | **869** (791 pass, 55 fail, 23 skipped) | `npm test` July 2026 |

| QA suite (`test/qa`) | **35 pass** (5 files) | `npm run test:qa` |

| PR-fast gate | **77 pass** (9 files) | `npm run test:pr-fast` |

| Helpers | `test/helpers/`, `test/qa/helpers/`, `test/qa/factories/` | see `TEST_FACTORIES_AND_BUILDERS.md` |

| CI workflow | `.github/workflows/accounting-verify.yml` | `test:pr-fast` then `npm test` |

| E2E / Playwright | **None** | deferred Phase 17 |

| Testcontainers | **None** | no deps |

| Coverage config | **None** | no `@vitest/coverage-*` |

| Security engine tests | `test/securityGovernance.engine.test.js` (27 cases) | exists |

| Pending security suites | `policy`, `sod`, `session` | per `docs/security-governance/PHASE_16_READINESS.md` |



---



## Finding ID namespaces (reused, not invented)



| Prefix | Origin | Used in QA docs |

|---|---|---|

| **SEC-1..4** | Phase 1 multi-tenant audit | Authorization matrix, security invariants |

| **R-01..25** | Phase 1 risk register | Regression catalogue, accounting invariants |

| **TEN-001..003** | Audit rule catalogue | Tenant isolation matrix |

| **CAP-005** | Capital/equity audit | Defect regression, ACC-INV |

| **TB-003** | Trial balance audit | ACC-INV, reports tests |

| **SAL-DUP / 5200** | CoA Phase 3 evidence | CoA tests, expense rollup |

| **5000** | Operating expense header | Income statement rollup tests |

| **LRD-017** | Loan readiness | Traceability matrix |

| **EQT-035** | Equity management | Defect regression |

| **GAP-SEC-*** | Phase 15 gap register | Security invariants, Phase 17 gates |

| **GAP-QA-*** | **New Phase 16** | `TEST_GAP_REGISTER.md` |



---



## Phase dependencies



```

Phases 1–14 (module docs + audits)

        ↓

Phase 15 (security code — BLOCKED for Phase 16 compliance)

        ↓

Phase 16 (this folder — test assurance)

        ↓

Phase 17 (coverage + integration hardening — see PHASE_17_READINESS.md)

        ↓

Phase 18 (release certification — see PHASE_18_READINESS.md)

```



Phase 16 **documentation (A–AQ, CE) and QA scaffolding (BW–CD) are DONE**. **Full CI green, HTTP integration suites, E2E, mutation, and migration CI remain IN_PROGRESS / DEFERRED** — see `PHASE_16_TASKS.md` and `FINAL_PHASE_16_REPORT.md`.



---



## How to run tests locally



```bash

npm ci

npx prisma generate



# PR gate (CI runs this first) — invariants, regressions, critical engines

npm run test:pr-fast



# Full Phase 16 QA catalogue only

npm run test:qa



# Invariants + regression + architecture + golden A

npm run test:invariants



# Release candidate check

npm run test:rc



# Generate certification artifact (runs test:qa, writes JSON)

npm run qa:certify



# Full suite (includes known failures — see GAP-QA-001)

npm test



# Optional DB read-only scenarios

npm run verify:accounting-scenario -- --tenant=QA-Accounting

```



DB-dependent suites use `describe.skipIf(!tenantReady)` and require tenant `QA-Accounting` (or `--tenant-id=`). See `TEST_DATABASE_ENVIRONMENT.md`.



---



## Related documentation



| Path | Relevance |

|---|---|

| `docs/security-governance/PHASE_16_READINESS.md` | Phase 15 → 16 gate |

| `docs/security-governance/PHASE_15_TASKS.md` | Security workstreams BW–BZ (tests) |

| `docs/accounting-audit/RISK_REGISTER.md` | R-01..25 |

| `docs/accounting-audit/AUDIT_RULE_CATALOGUE.md` | JRN/GL/AR/AP/CAP/TB/TEN rules |

| `docs/security-governance/SECURITY_CONTROL_GAP_REGISTER.md` | GAP-SEC-001+ |



---



## Document status



| Field | Value |

|---|---|

| Phase | 16 — Quality Assurance |

| Version | 1.1 |

| Last updated | July 2026 |

| Owner workstream | A (README), see `PHASE_16_TASKS.md` |

