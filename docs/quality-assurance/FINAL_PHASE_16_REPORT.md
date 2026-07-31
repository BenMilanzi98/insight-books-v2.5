# Final Phase 16 Report — Quality Assurance & Test Assurance

Honest closure report for Phase 16 documentation and **delivered** test scaffolding. **Evidence date:** July 2026.

---

## Executive summary

Phase 16 **documentation workstreams are complete** (37+ foundation documents in `docs/quality-assurance/`). **Critical QA scaffolding under `test/qa/` is implemented and green** (49 cases across invariants, regressions, architecture, golden Dataset A, multi-tenant matrix, seeded property tests, and failure-injection controls). **Full CI green (`npm test` zero failures), exhaustive posting-matrix automation, real parallel concurrency suites, Playwright E2E, mutation testing, and automated migration rehearsal remain deferred** — tracked with waivers in `TEST_WAIVER_GOVERNANCE.md` and gaps GAP-QA-001 through GAP-QA-025.

**Phase 16 does not claim 100% automation of acceptance criteria 1–182.** Traceability in `REQUIREMENT_TEST_TRACEABILITY_MATRIX.md` shows partial coverage; deepen coverage iteratively using the matrices and gap register.

---

## What shipped

### Documentation (complete)

| Area | Deliverables |
|---|---|
| Index & architecture | `README.md`, `CURRENT_TEST_ARCHITECTURE.md`, `TARGET_TEST_ARCHITECTURE.md`, `PHASE_1_TO_15_TEST_EVIDENCE_INDEX.md` |
| Gaps & governance | `TEST_GAP_REGISTER.md`, `RISK_REGISTER.md`, `FLAKY_*`, `TEST_WAIVER_GOVERNANCE.md`, `CI_QUALITY_GATES.md` |
| Invariants & traceability | `ACCOUNTING_INVARIANT_CATALOGUE.md`, `SECURITY_INVARIANT_CATALOGUE.md`, `REQUIREMENT_TEST_TRACEABILITY_MATRIX.md`, `DEFECT_REGRESSION_CATALOGUE.md` |
| Matrices | `POSTING_ENGINE_TEST_MATRIX.md`, `AUTHORIZATION_TEST_MATRIX.md`, `MULTI_TENANT_ISOLATION_MATRIX.md` |
| Migration & release | `MIGRATION_TEST_STRATEGY.md`, `MIGRATION_REHEARSAL_RUNBOOK.md`, `RELEASE_CERTIFICATION_PROCESS.md` |
| Phase handoff | `PHASE_17_READINESS.md`, `PHASE_18_READINESS.md`, `PHASE_16_TASKS.md` |
| Test engineering guides | `EXACT_DECIMAL_TESTING.md`, `TEST_FACTORIES_AND_BUILDERS.md`, `GOLDEN_ACCOUNTING_DATASETS.md`, etc. (this folder) |

### Executable QA scaffolding (`test/qa/` — **DONE, green**)

| Suite | File | Status |
|---|---|---|
| Accounting invariants | `invariants/accounting.invariants.test.js` | ✅ |
| Security invariants | `invariants/security.invariants.test.js` | ✅ |
| Defect regressions | `regression/defect.regressions.test.js` | ✅ |
| Static architecture | `architecture/static.boundaries.test.js` | ✅ |
| Golden Dataset A | `golden/datasetA.basicService.test.js` | ✅ |
| Multi-tenant isolation | `multi-tenant/isolation.matrix.test.js` | ✅ |
| Seeded property journals | `property/journal.properties.test.js` | ✅ |
| Failure injection (prod-safe) | `failure-injection/failureInjection.test.js` + `lib/qa/failureInjection.js` | ✅ |

**Helpers:** `moneyAssert.js`, `journalAssert.js`, `clock.js`, `seededRandom.js`  
**Factories:** `journalFactory.js`, `actorFactory.js`, `ids.js`  
**Fixture:** `golden/datasetA.expected.json`

### npm scripts & CI

| Command | Purpose | Status |
|---|---|---|
| `npm run test:pr-fast` | PR gate: `test/qa` + critical engine tests | ✅ 91 pass (July 2026) |
| `npm run test:qa` | Full `test/qa/**` | ✅ 49 pass |
| `npm run test:invariants` | Invariants + regression + architecture + golden | ✅ |
| `npm run test:rc` | Release candidate: `test:pr-fast` + `test:qa` | ✅ |
| `npm run qa:certify` | Writes `artifacts/quality-assurance/release-certification-*.json` | ✅ |

**CI:** `.github/workflows/accounting-verify.yml` runs `test:pr-fast` before full `npm test`.

---

## Confirmed regressions (executable evidence)

| Finding | Regression ID | Location | Notes |
|---|---|---|---|
| **MK1M capital not doubled** | REG-CAP-005 / REG-EQT-035 | `test/qa/regression/defect.regressions.test.js` | Exact `1000000.00` equity credit once |
| **5200 Salaries & Wages** | REG-SAL-5200 | same file | Payroll debit targets `5200`, not retired duplicates |
| **5xxx expense hierarchy** | REG-EXP-5000 | same file | Expense lines stay in 5xxx band |
| **Forecast never posts** | REG-PLAN-NOGL / ACC-INV-047 | regression + `accounting.invariants.test.js` | `projectThreeStatements` has no journals |
| **Loan readiness never posts** | REG-LRD-NOGL / ACC-INV-048 | regression + invariants | `assertNeverPostsToGl` on assessment |

Legacy suite failures for CAP-005 / 5000 header / TB-003 in `accountingV2.reports.test.js` remain (**FAILING** per `DEFECT_REGRESSION_CATALOGUE.md`) — the new `test/qa` regressions lock structural rules independently of report stub drift.

---

## Exact decimals

New QA helpers use **bigint minor units** via `lib/financialPlanning/domain/money.js` — no floating-point authority in `test/qa/**`:

- `parseToMinor`, `expectMinorEqual`, `sumMinors` — `test/qa/helpers/moneyAssert.js`
- Journal builders store `debit`/`credit` as `bigint` — `test/qa/factories/journalFactory.js`

Legacy tests still use `toBeCloseTo` in four files (documented in `FLAKY_AND_SKIPPED_TEST_REGISTER.md`, workstream AM). Migration to exact decimals is Phase 17 scope.

---

## What is deferred (Phase 17–18 / waivers)

| Area | Gap / task | Status | Waiver class |
|---|---|---|---|
| Full `npm test` green | GAP-QA-001, AV | IN_PROGRESS — 55 failures in legacy suites | W-FIX-SCHEDULED |
| Complete posting engine matrix (all event types × periods) | POSTING_ENGINE_TEST_MATRIX | **PARTIAL** — domain tests exist, matrix not fully automated | W-MATRIX-DEFER |
| Concurrency / race posting | GAP-QA-002 area, R-02 | **DEFERRED** — stub has `simulateRaceOnce`; no load suite | W-PHASE17 |
| Failure-injection (DB down, partial commit) | Framework shipped; posting-path hooks deferred | **PARTIAL** — `lib/qa/failureInjection.js` | W-PHASE17 |
| HTTP route integration (`test/qa/*-authz`, IDOR) | GAP-QA-003–010, BF–BV | **NOT_STARTED** | W-PHASE17 |
| Playwright E2E smoke | GAP-QA-015, BP | **NOT_STARTED** | W-PHASE17 |
| Mutation testing | — | **NOT_STARTED** — see `MUTATION_TESTING.md` | W-OPTIONAL |
| Migration rehearsal CI job | GAP-QA-025, AZ | **DEFERRED** — manual runbook only | W-MIG-MANUAL |
| Vitest coverage thresholds | GAP-QA-002, BA/BB | **NOT_STARTED** | W-PHASE17 |
| Golden datasets B–D | `GOLDEN_ACCOUNTING_DATASETS.md` | **DEFERRED** — Dataset A only | W-GOLDEN-EXPAND |

---

## Acceptance criteria honesty

| Claim | Accurate? |
|---|---|
| All Phase 16 docs published | ✅ Yes |
| `test/qa` scaffolding green | ✅ Yes (35/35) |
| `test:pr-fast` enforced in CI | ✅ Yes |
| Every ACC-INV / SEC-INV catalogue row automated | ❌ No (~44% / ~23% per AF/AG) |
| Every POSTING_ENGINE_TEST_MATRIX row automated | ❌ No — matrix is specification + partial coverage |
| All DEFECT_REGRESSION_CATALOGUE rows green | ❌ No — report + legacy posting failures open |
| Acceptance criteria 1–182 fully automated | ❌ **Not claimed** — see traceability matrix |

---

## Recommended sign-off posture

| Stakeholder | Can sign Phase 16 docs? | Can sign Phase 16 exit (AV)? |
|---|---|---|
| QA / Engineering | ✅ Documentation + scaffolding | ❌ Until GAP-QA-001 closed or waived for RC |
| Security | ✅ Invariant catalogue + engine tests | ❌ Until BW–BY HTTP suites or explicit waiver |
| Finance | ✅ Golden A + MK1M/5200 QA regressions | ❌ Until report suite failures resolved |
| DevOps | ✅ CI gates documented | ⚠️ Staging DB scenario still optional |

**Phase 17** owns closing GAP-QA-001, HTTP security suites, coverage, and E2E. **Phase 18** owns full release certification against all gates in `RELEASE_CERTIFICATION_PROCESS.md`.

---

## Document status

| Field | Value |
|---|---|
| Phase | 16 — closure report |
| Version | 1.0 |
| Last updated | July 2026 |
| Owner | Phase 16 QA lead |
