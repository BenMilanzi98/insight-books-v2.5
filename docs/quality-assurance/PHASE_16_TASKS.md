# Phase 16 Tasks



Quality Assurance workstreams **A–CF**. Status reflects July 2026 pass: **documentation A–CE DONE**; **QA scaffolding BW–CD DONE**; **infra AV–BV and deep automation CF–CK PARTIAL / DEFERRED**.



| ID | Workstream | Status | Depends | Deliverable |

|---|---|---|---|---|

| **A** | QA README / index | **DONE** | Phase 1–15 docs | `README.md` |

| **B** | Phase 1–15 test evidence index | **DONE** | A | `PHASE_1_TO_15_TEST_EVIDENCE_INDEX.md` |

| **C** | Current test architecture | **DONE** | A | `CURRENT_TEST_ARCHITECTURE.md` |

| **D** | Test gap register GAP-QA-001+ | **DONE** | C | `TEST_GAP_REGISTER.md` |

| **E** | Flaky & skipped register | **DONE** | C | `FLAKY_AND_SKIPPED_TEST_REGISTER.md` |

| **F** | Target test architecture | **DONE** | C, D | `TARGET_TEST_ARCHITECTURE.md` |

| **G** | Accounting invariant catalogue ACC-INV-001–050 | **DONE** | B | `ACCOUNTING_INVARIANT_CATALOGUE.md` |

| **H** | Security invariant catalogue SEC-INV-001–035 | **DONE** | B | `SECURITY_INVARIANT_CATALOGUE.md` |

| **I** | Requirement traceability matrix | **DONE** | G, H | `REQUIREMENT_TEST_TRACEABILITY_MATRIX.md` |

| **J** | Defect regression catalogue | **DONE** | G | `DEFECT_REGRESSION_CATALOGUE.md` |

| **K** | Posting engine test matrix | **DONE** | B | `POSTING_ENGINE_TEST_MATRIX.md` |

| **L** | Authorization test matrix | **DONE** | H | `AUTHORIZATION_TEST_MATRIX.md` |

| **M** | Multi-tenant isolation matrix | **DONE** | H | `MULTI_TENANT_ISOLATION_MATRIX.md` |

| **N** | Risk register (QA lens) | **DONE** | D | `RISK_REGISTER.md` |

| **O** | Test data architecture | **DONE** | C | `TEST_DATA_ARCHITECTURE.md` |

| **P** | Test coverage policy | **DONE** | F | `TEST_COVERAGE_POLICY.md` |

| **Q** | CI quality gates | **DONE** | F, P | `CI_QUALITY_GATES.md` |

| **R** | Flaky test policy | **DONE** | E | `FLAKY_TEST_POLICY.md` |

| **S** | Test waiver governance | **DONE** | R | `TEST_WAIVER_GOVERNANCE.md` |

| **T** | Migration test strategy | **DONE** | B | `MIGRATION_TEST_STRATEGY.md` |

| **U** | Migration rehearsal runbook | **DONE** | T | `MIGRATION_REHEARSAL_RUNBOOK.md` |

| **V** | Release certification process | **DONE** | Q | `RELEASE_CERTIFICATION_PROCESS.md` |

| **W** | Phase 17 readiness | **DONE** | F | `PHASE_17_READINESS.md` |

| **X** | Phase 18 readiness | **DONE** | V | `PHASE_18_READINESS.md` |

| **Y** | Phase 16 tasks (this file) | **DONE** | A–X | `PHASE_16_TASKS.md` |

| **Z** | Cross-link security Phase 16 readiness | **DONE** | Y | Update refs in security-governance docs |

| **AA** | Baseline test metrics capture | **DONE** | C | 869 cases, 55 fail documented |

| **AB** | Map skipped suites to waivers | **DONE** | E, S | W-SKIP-RETIRED class |

| **AC** | Map failing suites to GAP-QA | **DONE** | D | GAP-QA-001, 011, 013 |

| **AD** | Define `test/qa/` conventions | **DONE** | F | `UNIT_TEST_STANDARDS.md` |

| **AE** | Traceability THR-007–016 gap analysis | **DONE** | I | ~15% current coverage |

| **AF** | ACC-INV coverage gap analysis | **DONE** | G | ~44% fully tested |

| **AG** | SEC-INV coverage gap analysis | **DONE** | H | ~23% fully tested |

| **AH** | Align with Phase 15 BW–BZ | **DONE** | security-governance | Shared suite paths |

| **AI** | Document legacy posting removal impact | **DONE** | J | DEF-LEG-POST-* |

| **AJ** | Document reports suite failure blast radius | **DONE** | J | 40 cases |

| **AK** | CI workflow gap analysis | **DONE** | Q | Optional DB step |

| **AL** | Define REG-* naming standard | **DONE** | J | Prefix convention |

| **AM** | Inventory `toBeCloseTo` usage | **DONE** | E | 4 files → `EXACT_DECIMAL_TESTING.md` |

| **AN** | Link audit rules → invariants | **DONE** | G | AUDIT_RULE_CATALOGUE |

| **AO** | Link GAP-SEC → planned tests | **DONE** | I | Matrix rows |

| **AP** | Phase 16 sign-off checklist draft | **DONE** | Y | See below |

| **AQ** | Publish docs folder | **DONE** | A–AP | `docs/quality-assurance/` |

| **AR** | Team review — gap register | **PENDING** | D | Sign-off meeting |

| **AS** | Team review — CI gates | **PENDING** | Q | Eng + DevOps |

| **AT** | Fix `accountingV2.reports.test.js` failures | **PENDING** | GAP-QA-011 | 0 fail |

| **AU** | Fix period close test failures | **PENDING** | GAP-QA-001 | 5 cases |

| **AV** | CI green — zero Vitest failures | **IN_PROGRESS** | AT, AU, AW | GAP-QA-001 |

| **AW** | Legacy `postGlEntry` caller migration | **IN_PROGRESS** | GAP-QA-013 | 3 test files |

| **AX** | Require DB scenario on staging | **IN_PROGRESS** | GAP-QA-022 | nightly job |

| **AY** | Flaky quarantine workflow in CI | **PENDING** | R | label + track |

| **AZ** | Migration rehearsal script in CI | **DEFERRED** | U | Waiver W-MIG-MANUAL |

| **BA** | Vitest coverage config | **PENDING** | P | v8 provider |

| **BB** | Coverage thresholds in CI | **PENDING** | BA | 70% accountingV2 |

| **BC** | Extract `httpTestClient.js` helper | **PENDING** | AD | `test/helpers/` |

| **BD** | Extract `qaTenantFactory.js` | **PENDING** | O | minimal seed |

| **BE** | QA tenant seed job for CI | **PENDING** | O, BD | GitHub Action |

| **BF** | `test/qa/supplier-idor.test.js` | **PENDING** | BC, Phase 15 R | SEC-2 |

| **BG** | `test/qa/reversal-authz.test.js` | **PENDING** | BC | SEC-3 |

| **BH** | `test/qa/middleware-catalogue.test.js` | **PENDING** | Phase 15 L, M | GAP-SEC-011 |

| **BI** | `test/securityGovernance.policy.test.js` | **PENDING** | Phase 15 BJ | BW |

| **BJ** | `test/securityGovernance.sod.test.js` | **PENDING** | Phase 15 U | BX |

| **BK** | `test/securityGovernance.session.test.js` | **PENDING** | Phase 15 I, J | BY |

| **BL** | `test/qa/equity-approval.test.js` | **PENDING** | BC | EQT SoD |

| **BM** | `test/qa/loan-readiness-sod.test.js` | **PENDING** | BC | LRD-017 chain |

| **BN** | `test/qa/liability-journal-link.test.js` | **PENDING** | — | AP-004 |

| **BO** | DB skipIf — staging always runs | **PENDING** | BE | GAP-QA-014 |

| **BP** | Playwright smoke scaffold | **DEFERRED** | W | W-PHASE17 |

| **BQ** | Testcontainers spike | **DEFERRED** | W | optional |

| **BR** | Retire/archive skipped posting tests | **PENDING** | AB | GAP-QA-017 |

| **BS** | API route manifest generator | **PENDING** | BH | unlisted prefix fail |

| **BT** | `test/qa/webhook-replay.test.js` | **PENDING** | — | GAP-SEC-022 |

| **BU** | `test/qa/upload-gateway.test.js` | **PENDING** | — | GAP-SEC-009 |

| **BV** | `test/qa/ai-governance.test.js` | **PENDING** | — | GAP-SEC-018 |

| **BW** | `test/qa` helpers (money, journal, clock, PRNG) | **DONE** | AD | `test/qa/helpers/*` |

| **BX** | `test/qa` factories (journal, actor, ids) | **DONE** | BW | `test/qa/factories/*` |

| **BY** | Accounting + security invariant suites | **DONE** | BX, G, H | `test/qa/invariants/*` |

| **BZ** | Defect regression suite (REG-*) | **DONE** | BX, J | `test/qa/regression/defect.regressions.test.js` |

| **CA** | Static architecture boundary tests | **DONE** | AD | `test/qa/architecture/static.boundaries.test.js` |

| **CB** | Golden Dataset A | **DONE** | BX | `test/qa/golden/*` |

| **CC** | npm scripts (`test:pr-fast`, `test:qa`, `test:rc`, …) | **DONE** | BY–CB | `package.json` |

| **CD** | Release certification generator | **DONE** | V | `scripts/qa-release-certification.cjs` |

| **CE** | Phase 16 engineering docs | **DONE** | O, AD | `EXACT_DECIMAL_TESTING.md`, etc. |

| **CF** | Full posting matrix automation | **PARTIAL** | K | Domain tests only; matrix rows manual |

| **CG** | Concurrency / race posting suite | **DEFERRED** | R-02 | W-PHASE17; stub `simulateRaceOnce` only |

| **CH** | Failure-injection tests | **DEFERRED** | — | W-PHASE17 |

| **CI** | Mutation testing | **DEFERRED** | BA | `MUTATION_TESTING.md`, W-OPTIONAL |

| **CJ** | Golden datasets B–D | **DEFERRED** | CB | `GOLDEN_ACCOUNTING_DATASETS.md` |

| **CK** | Phase 16 final report | **DONE** | CE, BW–CD | `FINAL_PHASE_16_REPORT.md` |



---



## Status summary



| Category | DONE | IN_PROGRESS | PARTIAL | DEFERRED | PENDING |

|---|---|---|---|---|---|

| Documentation (A–AQ, CE, CK) | 46 | 0 | 0 | 0 | 0 |

| QA scaffolding (BW–CD) | 7 | 0 | 0 | 0 | 0 |

| Deep automation (CF–CI, CJ) | 0 | 0 | 1 | 4 | 0 |

| Review (AR–AS) | 0 | 0 | 0 | 0 | 2 |

| Test fixes (AT–AW) | 0 | 3 | 0 | 0 | 1 |

| Infra & suites (AX–BV, BA–BE) | 0 | 2 | 0 | 3 | 17 |



---



## Critical path



```

test:pr-fast green (CC) ✅ → AV (full npm test green) → BA/BB (coverage) → BF–BK (security suites) → Phase 17

         ↘ AT/AU/AW (parallel fix failing suites)

         ↘ CF–CH deferred with waivers (Phase 17)

```



---



## Phase 16 exit criteria



1. **GAP-QA-001 closed** — `npm test` exits 0 on default branch. **NOT MET** (55 failures); `test:pr-fast` **MET** (77 pass).

2. **GAP-QA-024 progress** — ≥90% THR-007–016 scenarios have tests (BF–BK + engine). **NOT MET** (~15%).

3. **Documentation** — this folder complete (A–AQ, CE, CK) ✅

4. **CI gates** — `test:pr-fast` enforced; full unit job still fails until AV ✅ partial

5. **QA scaffolding** — invariants, regression, architecture, golden A (BW–CB) ✅

6. **Phase 15 coordination** — BW–BY security suites exist or waived with ticket. **NOT MET** (waived → Phase 17)



**Honesty:** Phase 16 does **not** claim 100% automation of acceptance criteria 1–182. See `FINAL_PHASE_16_REPORT.md`.



---



## Sign-off checklist (draft)



- [ ] Engineering lead — CI green (AV) or RC waiver documented

- [x] QA lead — documentation + `test/qa` scaffolding (AQ, BW–CD, CK)

- [ ] Security — SEC-INV traceability ≥25 covered (AG, BF–BK)

- [x] Finance — MK1M / 5200 / expense hierarchy QA regressions (BZ)

- [ ] DevOps — staging DB scenario scheduled (AX, BE)



---



## Document status



| Field | Value |

|---|---|

| Version | 1.1 |

| Last updated | July 2026 |

| Owner | Y |

