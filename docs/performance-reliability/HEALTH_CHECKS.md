# Health Checks

Liveness, readiness, and startup probes for InsightBooks V2.

---

## Current state

| Route | Status |
|---|---|
| `/api/health` | **NOT FOUND** (Dockerfile references it — stale) |
| `/api/ready` | **NOT FOUND** |
| `/api/live` | **NOT FOUND** |
| `/api/system/health` | **IN PROGRESS** (parallel delivery) |
| `/api/system/ready` | **IN PROGRESS** |
| `/api/system/live` | **IN PROGRESS** |

Implementation target: `lib/performanceReliability/` + `app/api/system/*`.

---

## Probe definitions

| Probe | Path | Checks | Use |
|---|---|---|---|
| **Liveness** | `/api/system/live` | Event loop responsive | Restart container if fail |
| **Readiness** | `/api/system/ready` | DB `SELECT 1`, Prisma connected | Remove from LB traffic |
| **Health (aggregate)** | `/api/system/health` | Live + ready + version info | Dashboards, synthetic monitoring |

---

## Response shape (DRAFT)

```json
{
  "status": "ok" | "degraded" | "fail",
  "checks": {
    "database": { "status": "ok", "latencyMs": 12 },
    "outbox": { "status": "warn", "pending": 150 }
  },
  "version": "0.1.0",
  "gitSha": "optional"
}
```

Do not expose secrets or internal hostnames.

---

## Docker / Compose

Update `Dockerfile` HEALTHCHECK and `docker-compose.yml` to use `/api/system/live` or `/ready` once shipped.

---

## Kubernetes / PM2 (future)

| Probe | Initial delay | Period |
|---|---|---|
| liveness | 10 s | 30 s |
| readiness | 5 s | 10 s |

---

## Cross-links

- [SYNTHETIC_MONITORING.md](./SYNTHETIC_MONITORING.md)
- [OPERATIONAL_RUNBOOKS.md](./OPERATIONAL_RUNBOOKS.md)
