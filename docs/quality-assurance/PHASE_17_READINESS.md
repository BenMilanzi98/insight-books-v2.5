# Phase 17 Readiness — Test Expansion & Hardening

Successor phase to Phase 16 QA documentation + infra. **Blocked on Phase 16 exit criteria** (see `PHASE_16_TASKS.md`).

**Performance & reliability track (parallel):** Documentation lives at [`docs/performance-reliability/`](../performance-reliability/README.md). Runtime scaffolding (health probes, metrics, tenant fairness, load harness) lives at `lib/performanceReliability/`. See [`FINAL_PHASE_17_REPORT.md`](../performance-reliability/FINAL_PHASE_17_REPORT.md) for status — docs/scaffolding **DONE**; measured load/soak/capacity **CERTIFICATION PENDING**.

---

## Purpose

Expand from **Vitest unit/integration** to **coverage enforcement, E2E smoke, and operational test jobs** without blocking Phase 15 security code delivery.

| Theme | Deliverables |
|---|---|
| Coverage | `@vitest/coverage-v8`, CI Gate G2 |
| E2E | Playwright smoke (login, TB, invoice) |
| DB CI | Nightly QA tenant seed + G5 mandatory on staging |
| Testcontainers | Optional local PG for contributors |
| Performance | Baseline API latency benchmarks (optional) |

---

## Entry gates (from Phase 16)

| # | Gate | Evidence | Status |
|---|---|---|---|
| 1 | Phase 16 docs complete | `docs/quality-assurance/` A–AQ | **MET** |
| 2 | CI green G1 | `npm test` exit 0 | **NOT MET** — 55 failures |
| 3 | Security suites exist | BW–BK / `test/qa/*` | **NOT MET** |
| 4 | Coverage tooling | vitest coverage config | **NOT MET** |
| 5 | Phase 15 code exit | `docs/security-governance/PHASE_16_READINESS.md` gates | **NOT MET** |

---

## Planned workstreams (preview)

| ID | Workstream | Depends |
|---|---|---|
| P17-A | Install Playwright + smoke specs | G1 green |
| P17-B | `test/e2e/smoke/login.spec.js` | P17-A |
| P17-C | `test/e2e/smoke/trial-balance.spec.js` | P17-A |
| P17-D | GitHub nightly staging workflow | BE, AX |
| P17-E | Testcontainers spike doc | BQ |
| P17-F | API perf baseline (k6 or autocannon) | optional |
| P17-G | Visual regression — **deferred** | — |
| P17-H | Contract tests from route manifest | BS |
| P17-I | Phase 18 readiness doc | P17-A–D |

---

## Test inventory targets

| Metric | Phase 16 (current) | Phase 17 target |
|---|---|---|
| Test cases | 869 | 950+ |
| `test/qa/` files | 0 | ≥10 |
| THR-007–016 coverage | ~15% | ≥90% |
| Line coverage accountingV2 | unmeasured | ≥70% |
| E2E specs | 0 | 5–10 |

---

## Risks if Phase 17 starts early

| Risk | Mitigation |
|---|---|
| E2E flakes on broken unit base | Require G1 green first |
| Playwright cost in CI | Nightly only initially |
| Coverage gaming | Pair with ACC-INV matrix |

---

## Handoff from Phase 16

Complete workstreams AV–BV before kickoff:
- AV — CI green
- BA/BB — coverage
- BF–BK — security suites
- BE — QA tenant seed job

---

## Document status

| Field | Value |
|---|---|
| Version | 0.1 |
| Last updated | July 2026 |
| Owner | Phase 16 → 17 transition |
