# Service Level Objectives (SLOs)

**Status: DRAFT — pending baseline measurement.** Targets below are design goals, not certified commitments. Promote to **CERTIFIED** only after [BASELINE_PERFORMANCE_REPORT.md](./BASELINE_PERFORMANCE_REPORT.md) and [CAPACITY_CERTIFICATION.md](./CAPACITY_CERTIFICATION.md).

---

## Platform availability (DRAFT)

| SLO | Target | Window | SLI |
|---|---|---|---|
| API liveness | 99.5% | 30 days | `availability_ratio` |
| API readiness | 99.0% | 30 days | `ready_ratio` |

*Pilot / single-node deployment — not multi-region HA.*

---

## Latency (DRAFT)

| Route class | p95 target | p99 target | Notes |
|---|---|---|---|
| Posting (CP-01) | 800 ms | 2 s | Includes full transaction |
| Ledger list (CP-10) | 500 ms | 1.5 s | First page |
| Trial balance (CP-12, warm cache) | 1 s | 3 s | Cache hit |
| Trial balance (cold) | 5 s | 15 s | Acceptable async UX future |
| Login (CP-30) | 300 ms | 1 s | |

Replace with **MEASURED** baselines + 20% headroom when certifying.

---

## Correctness (zero tolerance — not draft)

| SLO | Target |
|---|---|
| Duplicate posting | **0** per rolling 30 days |
| Stale cache served as current | **0** |
| Cross-tenant data exposure | **0** |

See [ERROR_BUDGET_POLICY.md](./ERROR_BUDGET_POLICY.md).

---

## Background / async (DRAFT)

| SLO | Target | SLI |
|---|---|---|
| Outbox pending age p95 | < 15 min | `outbox_pending_age` (when dispatcher exists) |
| Cron job success | 99% per job | Cron route 2xx ratio |

---

## Error budget (DRAFT)

| Tier | Monthly budget |
|---|---|
| Availability 99.5% | ~3.6 hours downtime |
| Latency-only breaches | 5% of requests may exceed p95 **after** baseline set |

Correctness SLOs have **no budget**.

---

## Review cadence

- After baseline: adjust targets to measured p95 + margin
- Quarterly: revisit with [COST_AND_CAPACITY_ANALYSIS.md](./COST_AND_CAPACITY_ANALYSIS.md)

---

## Cross-links

- [SERVICE_LEVEL_INDICATORS.md](./SERVICE_LEVEL_INDICATORS.md)
- [PLATFORM_PERFORMANCE_READINESS.md](./PLATFORM_PERFORMANCE_READINESS.md)
