# Target Performance Architecture

End-state design for InsightBooks V2 performance and reliability. **Not fully implemented** — gaps called out vs [CURRENT_PERFORMANCE_ARCHITECTURE.md](./CURRENT_PERFORMANCE_ARCHITECTURE.md).

---

## Design principles

1. **Correctness first** — posting idempotency and GL authority unchanged under load.
2. **Measure before optimize** — baseline before SLO certification.
3. **Tenant isolation** — fairness limits prevent noisy-neighbor on shared infrastructure.
4. **Cache is convenience** — `AcctV2ReportCache` and projections never override canonical ledger.
5. **Observable by default** — every critical path emits latency, error, and saturation metrics.

---

## Target topology

```
                    ┌─────────────────┐
                    │  Load balancer  │  (future: nginx / cloud LB)
                    └────────┬────────┘
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         [Next.js #1]  [Next.js #2]  [Next.js #N]
              │              │              │
              └──────────────┼──────────────┘
                             │ Prisma (sized pool per instance)
              ┌──────────────┴──────────────┐
              ▼                             ▼
      [PostgreSQL primary]          [Read replica]  (future)
              │
      [AcctV2ReportCache table]
              │
      [Optional Redis]  (rate limit + session at scale)
              │
      [Outbox dispatcher worker]
```

---

## Component targets

| Component | Current | Target |
|---|---|---|
| Health | Missing `/api/health` | `/api/system/health`, `/ready`, `/live` |
| Metrics | Ad hoc logging | Structured metrics via `lib/performanceReliability/` |
| Rate limit | In-memory | Redis or edge limiter when N > 1 |
| Report cache | DB table | Keep DB table; optional read-through memoization per process |
| Outbox | Enqueue only | Dedicated dispatcher with retry/backoff |
| Load testing | None | k6 scripts in repo + CI smoke threshold |
| Connection pool | Default | Explicit `connection_limit` per instance |
| HA | Single node | Active-passive DB + multi-app behind LB (Phase 18+) |

---

## Critical path enhancements (non-breaking)

| Path | Enhancement |
|---|---|
| Posting | Maintain single transaction; add queue depth metric only |
| Trial balance | Prefer projection + cache; canonical fallback always available |
| Ledger drill-down | Windowed running-balance checkpoints from projection |
| Exports | Streaming responses; optional async job + download link |

---

## Observability target

- **Traces:** W3C trace context on API routes ([APM_AND_TRACING.md](./APM_AND_TRACING.md))
- **Logs:** JSON with `tenantId`, `requestId`, `route`, `durationMs`
- **Metrics:** RED (rate, errors, duration) per [REQUIRED_METRICS.md](./REQUIRED_METRICS.md)
- **Dashboards:** [OBSERVABILITY_DASHBOARDS.md](./OBSERVABILITY_DASHBOARDS.md)

---

## Certification path

1. Implement health + metrics (P17-PR-B..E)
2. Run [LOAD_TEST_PLAN.md](./LOAD_TEST_PLAN.md) → [BASELINE_PERFORMANCE_REPORT.md](./BASELINE_PERFORMANCE_REPORT.md)
3. Promote draft SLOs in [SERVICE_LEVEL_OBJECTIVES.md](./SERVICE_LEVEL_OBJECTIVES.md) to **CERTIFIED** only after baseline + capacity test

---

## Cross-links

- [SCALING_STRATEGY.md](./SCALING_STRATEGY.md)
- [HIGH_AVAILABILITY_ARCHITECTURE.md](./HIGH_AVAILABILITY_ARCHITECTURE.md)
