# Performance Regression Gates

CI and release gates for performance regressions.

---

## Gate G-Perf-1 — Smoke latency (NOT STARTED)

| Item | Spec |
|---|---|
| Trigger | PR to main / nightly |
| Tool | k6 or autocannon |
| Scope | Login + 1 posting + TB read |
| Fail if | p95 > 150% of stored baseline OR error rate > 1% |

Baseline file: commit artifact from [BASELINE_PERFORMANCE_REPORT.md](./BASELINE_PERFORMANCE_REPORT.md) (e.g. `artifacts/performance/baseline.json`).

---

## Gate G-Perf-2 — Correctness (always on)

| Item | Spec |
|---|---|
| Trigger | Every CI |
| Tests | `npm run test:invariants`, posting idempotency tests |
| Fail if | any failure |

---

## Gate G-Perf-3 — Pool config review (manual)

| Item | Spec |
|---|---|
| Trigger | Infra change (PM2 count, DATABASE_URL) |
| Check | [CONNECTION_POOL_MANAGEMENT.md](./CONNECTION_POOL_MANAGEMENT.md) headroom |

---

## Waiver process

Document in PR if G-Perf-1 skipped — max 7 days, ticket required.

---

## Cross-links

- [quality-assurance/CI_QUALITY_GATES.md](../quality-assurance/CI_QUALITY_GATES.md)
- [PHASE_17_TASKS.md](./PHASE_17_TASKS.md) P17-PR-N
