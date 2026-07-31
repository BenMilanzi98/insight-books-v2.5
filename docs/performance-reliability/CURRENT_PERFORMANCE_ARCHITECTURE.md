# Current Performance Architecture

Verified inventory of the as-built InsightBooks V2 platform (July 2026). **No production latency or throughput numbers are claimed here** — see [BASELINE_PERFORMANCE_REPORT.md](./BASELINE_PERFORMANCE_REPORT.md).

---

## Application stack

| Layer | Verified version / detail |
|---|---|
| Framework | Next.js `^16.2.9` in `package.json`; lockfile often resolves **15.5.x** |
| UI | React **19** |
| ORM | Prisma **6.x** (`@prisma/client` / `prisma` ^6.x) |
| Database | PostgreSQL **15** (`postgres:15-alpine` in `docker-compose.yml`) |
| Runtime | Node **20** (`node:20-alpine` in `Dockerfile`) |
| Process model | `next start` / standalone Docker image; **PM2** referenced in deploy scripts/docs only |

---

## Data access

| Item | Current state |
|---|---|
| Client | Prisma singleton in `lib/prisma.js` — global reuse in dev/prod |
| Pool config | **No** `connection_limit` (or `pool_timeout`) in typical `DATABASE_URL` |
| Indexes | **554** `@@index` entries in `prisma/schema.prisma` (verified count) |
| Read replicas | **None** configured |
| Redis | **None** — no Redis client or cache layer in repo |

---

## Caching

| Cache | Implementation |
|---|---|
| Financial reports | PostgreSQL table `AcctV2ReportCache` via `lib/accountingV2/reporting/reportCacheService.js` |
| Ledger projection | Optional `AcctV2LedgerBalance` when `accountingV2LedgerProjection` flag enabled |
| HTTP / CDN | Next.js static assets only; **no nginx conf** in repo |
| Session | Cookie/session store (app-specific; not a shared Redis cluster) |

Report cache is **read-through, version-invalidated** — never authoritative over the GL. See [CACHE_ARCHITECTURE.md](./CACHE_ARCHITECTURE.md) and [accounting-reports/REPORT_CACHE.md](../accounting-reports/REPORT_CACHE.md).

---

## Rate limiting & security

| Mechanism | Location | Limitation |
|---|---|---|
| In-memory sliding window | `lib/securityGovernance/domain/rateLimit.js` | Per-process; not shared across PM2/Docker replicas |
| Login rate limit | `app/api/auth/login/route.js` | Uses `checkRateLimit` |
| Feature flag | `rateLimitingV2Enabled` in `lib/accountingV2/infrastructure/featureFlags.js` | Gradual rollout |

---

## Async & background work

| Pattern | Status |
|---|---|
| Transactional outbox enqueue | **Exists** — `lib/accountingV2/infrastructure/outbox.js`, `AcctV2OutboxMessage` table |
| Outbox dispatcher worker | **NOT FOUND** in repo — rows accumulate; ARCH-005 monitors backlog |
| Cron HTTP routes | Multiple under `app/api/cron/*` gated by `CRON_SECRET` |
| Job queue (Bull, SQS, etc.) | **None** |

---

## Critical domain paths

| Service | Path |
|---|---|
| Posting engine | `lib/accountingV2/engine/postingEngine.js` |
| Ledger queries | `lib/accountingV2/ledger/ledgerQueryService.js` |
| Financial reports | `lib/accountingV2/reporting/financialReportService.js` |
| Trial balance | `lib/accountingV2/reporting/trialBalanceService.js` |

See [CRITICAL_PATH_INVENTORY.md](./CRITICAL_PATH_INVENTORY.md).

---

## Deployment topology (typical today)

```
[Browser] → [Single Node: Next.js :3000]
                ↓ Prisma pool (default sizing)
            [PostgreSQL 15]
```

- **Docker Compose** present (`docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.prod.yml`)
- **No nginx** configuration in repository
- **PM2** used in `deploy.sh` and deployment docs for VPS-style hosting
- Dockerfile `HEALTHCHECK` references `/api/health` — **route not present** at time of inventory; replacement planned at `/api/system/health`, `/ready`, `/live`

---

## Performance module (Phase 17 runtime)

Code under `lib/performanceReliability/` (parallel delivery):

- Health probe handlers
- Request metrics middleware
- Tenant fairness / concurrency guards
- Load-test harness hooks

Documented in [HEALTH_CHECKS.md](./HEALTH_CHECKS.md), [PRODUCTION_OBSERVABILITY.md](./PRODUCTION_OBSERVABILITY.md), [TENANT_FAIRNESS.md](./TENANT_FAIRNESS.md).

---

## Testing & benchmarks

| Asset | Status |
|---|---|
| k6 / autocannon scripts | **None** in repo yet |
| Phase 16 QA | `test/qa/**` + `test/qa/failure-injection/failureInjection.test.js` |
| Vitest integration | `test/accountingV2.*.test.js` — correctness, not load |

---

## Known architectural constraints

1. **Single DB writer** — all tenants share one PostgreSQL instance in typical deploys.
2. **Prisma default pool** — must be sized against `max_connections` × process count ([CONNECTION_POOL_MANAGEMENT.md](./CONNECTION_POOL_MANAGEMENT.md)).
3. **No distributed cache** — report cache and rate limits are DB- or process-local.
4. **Outbox without dispatcher** — downstream notifications may lag; not a posting bottleneck but a reliability gap.

---

## Cross-links

- [TARGET_PERFORMANCE_ARCHITECTURE.md](./TARGET_PERFORMANCE_ARCHITECTURE.md)
- [WORKLOAD_MODEL.md](./WORKLOAD_MODEL.md)
- [accounting-architecture/RISK_REGISTER.md](../accounting-architecture/RISK_REGISTER.md) — P2-06 outbox dispatcher
