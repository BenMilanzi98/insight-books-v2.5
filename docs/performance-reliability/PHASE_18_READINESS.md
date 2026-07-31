# Phase 18 Readiness — Performance Handoff

Prerequisites from Phase 17 before production financial cutover certification (Phase 18 QA track: [quality-assurance/PHASE_18_READINESS.md](../quality-assurance/PHASE_18_READINESS.md)).

**Production cutover documentation (framework — cutover NOT EXECUTED):** [`docs/production-cutover/`](../production-cutover/README.md) — capacity gate referenced in [`PRODUCTION_DEPENDENCY_MAP.md`](../production-cutover/PRODUCTION_DEPENDENCY_MAP.md); performance validation template: [`PERFORMANCE_VALIDATION.md`](../production-cutover/PERFORMANCE_VALIDATION.md).

---

## Phase 17 exit gates (performance track)

| # | Gate | Evidence | Status |
|---|---|---|---|
| 1 | Performance doc tree complete | `docs/performance-reliability/` | **MET** |
| 2 | Health endpoints live | `/api/system/health`, `/ready`, `/live` | **IN PROGRESS** |
| 3 | Metrics emitted | [REQUIRED_METRICS.md](./REQUIRED_METRICS.md) | **IN PROGRESS** |
| 4 | Baseline report with MEASURED data | [BASELINE_PERFORMANCE_REPORT.md](./BASELINE_PERFORMANCE_REPORT.md) | **NOT MET** |
| 5 | Load + soak executed once | Test plan artifacts | **NOT MET** |
| 6 | Capacity signed or NOT CERTIFIED | [CAPACITY_CERTIFICATION.md](./CAPACITY_CERTIFICATION.md) | **NOT CERTIFIED** |
| 7 | DR restore timed | [RECOVERY_OBJECTIVES.md](./RECOVERY_OBJECTIVES.md) | **NOT MET** |
| 8 | SLO draft → certified or waived | [SERVICE_LEVEL_OBJECTIVES.md](./SERVICE_LEVEL_OBJECTIVES.md) | **DRAFT** |

---

## Combined Phase 18 dependencies

| Track | Owner doc |
|---|---|
| QA E2E + coverage | `docs/quality-assurance/PHASE_18_READINESS.md` |
| Performance + ops | This folder |
| Security | `docs/security-governance/` |

---

## Recommended sequence

1. Finish P17-PR-B..E (runtime module)
2. Run load/soak → baseline → capacity cert
3. Timed DR drill
4. Enable G-Perf-1 in CI
5. Phase 18 cutover review

---

## Cross-links

- [PLATFORM_PERFORMANCE_READINESS.md](./PLATFORM_PERFORMANCE_READINESS.md)
- [FINAL_PHASE_17_REPORT.md](./FINAL_PHASE_17_REPORT.md)
