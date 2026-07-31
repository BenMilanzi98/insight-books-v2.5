# Graceful Shutdown

Draining in-flight work when stopping Node.js / Next.js processes.

---

## Signals

| Signal | Handler |
|---|---|
| SIGTERM | PM2, Docker, Kubernetes default |
| SIGINT | Local dev |

---

## Target behavior

1. Stop accepting new HTTP connections
2. Wait for in-flight requests up to **drain_timeout** (DRAFT 25 s)
3. Close Prisma connection pool (`$disconnect()`)
4. Exit 0

Hook location: `lib/performanceReliability/` shutdown handler (in progress).

---

## Posting in flight

- In-flight `$transaction` should commit or rollback as a unit
- Clients must retry with **same idempotency key** if disconnected mid-request
- No partial journal persistence (atomic persistence guarantee)

---

## PM2

```bash
pm2 restart insight-books --kill-timeout 30000
```

Ensure `kill_timeout` ≥ drain timeout.

---

## Docker Compose

`stop_grace_period: 30s` on app service (recommended).

---

## Cron overlap

If SIGTERM during cron route: handler should be idempotent — safe to rerun next schedule.

---

## Cross-links

- [RETRY_POLICY.md](./RETRY_POLICY.md)
- [HIGH_AVAILABILITY_ARCHITECTURE.md](./HIGH_AVAILABILITY_ARCHITECTURE.md)
