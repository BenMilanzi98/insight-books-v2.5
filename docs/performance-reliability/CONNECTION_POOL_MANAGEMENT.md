# Connection Pool Management

Prisma connection pooling for InsightBooks V2 — singleton client in `lib/prisma.js`, **no `connection_limit` in typical `DATABASE_URL`**.

---

## Current behavior

- One `PrismaClient` per Node process (global singleton)
- Default pool size ≈ `num_physical_cpus × 2 + 1` per process (Prisma default)
- All routes share the same pool within a process

---

## Capacity formula

```
total_app_connections = num_processes × pool_size_per_process
required_headroom = max_connections - total_app_connections - admin_reserve
```

| Deployment | Example calculation |
|---|---|
| Docker Compose (1 app container, 4 vCPU) | 1 × 9 = **9** connections |
| PM2 × 2 instances, 4 vCPU each | 2 × 9 = **18** connections |
| PM2 × 4 on 8 vCPU | 4 × 17 = **68** connections |

With PostgreSQL `max_connections = 100` and `admin_reserve = 10`:

- 4-instance deploy → headroom = 100 - 68 - 10 = **22** ✓
- 8-instance deploy without tuning → **risk of exhaustion**

---

## Recommended configuration

Set explicitly in `DATABASE_URL` (example — tune per environment):

```
postgresql://user:pass@host:5432/insightbooks?connection_limit=5&pool_timeout=10
```

Then:

```
total = num_processes × connection_limit
```

**Rule:** Document actual values in deployment runbook; verify with `pg_stat_activity` during peak.

---

## PostgreSQL server side

| Setting | Guidance |
|---|---|
| `max_connections` | Raise only with memory for `shared_buffers` / per-connection work_mem |
| PgBouncer | Consider when `total_app_connections > 50` or many short-lived workers |
| Idle timeout | Align with load balancer and [GRACEFUL_SHUTDOWN.md](./GRACEFUL_SHUTDOWN.md) |

---

## Failure modes

| Symptom | Likely cause | Action |
|---|---|---|
| `Timed out fetching a new connection` | Pool too small or leak | Increase limit or reduce processes |
| `too many clients already` | Sum of pools > max | Reduce per-process limit or raise PG max |
| Slow after deploy | Connection stampede | Stagger PM2 restarts |

---

## Verification checklist

- [ ] Record `num_processes` and `connection_limit` in staging
- [ ] Load test until pool wait SLI appears ([SERVICE_LEVEL_INDICATORS.md](./SERVICE_LEVEL_INDICATORS.md))
- [ ] Confirm headroom ≥ 10 in [CAPACITY_CERTIFICATION.md](./CAPACITY_CERTIFICATION.md)

---

## Cross-links

- [CAPACITY_MODEL.md](./CAPACITY_MODEL.md)
- [BACKPRESSURE.md](./BACKPRESSURE.md)
