# High Availability Architecture

Honest assessment of InsightBooks V2 availability posture (July 2026).

---

## Today (typical production)

| Component | HA level |
|---|---|
| Application | **Single node** or PM2 cluster on one VPS — not multi-AZ |
| Database | **Single PostgreSQL 15** instance |
| Load balancer | Often **none** — direct :3000 exposure or external nginx not in repo |
| Redis | **None** |
| Backups | File/pg_dump scripts in docs — schedule operator-dependent |

**Conclusion:** Pilot-grade availability — not certified for 99.99% multi-region SLA.

---

## Failure modes

| Failure | User impact | Mitigation today |
|---|---|---|
| App process crash | Brief outage | PM2 restart / Docker restart |
| DB disk full | Full outage | Monitoring (manual) |
| Host loss | Full outage until restore | [DISASTER_RECOVERY_RUNBOOK.md](./DISASTER_RECOVERY_RUNBOOK.md) |
| Deploy bad build | Outage until rollback | [ROLLBACK_STRATEGY.md](./ROLLBACK_STRATEGY.md) |

---

## Near-term improvements (Phase 17–18)

1. `/api/system/ready` for accurate traffic drain
2. Timed backup restore drill → [RECOVERY_OBJECTIVES.md](./RECOVERY_OBJECTIVES.md)
3. Connection pool sizing under PM2 cluster

---

## Target (post-pilot)

```
        [LB]
       /    \
  [App 1] [App 2]     (stateless Next.js)
       \    /
    [PG primary]
         |
    [PG standby]       (streaming replication)
```

Optional: PgBouncer, Redis for sessions/rate limits.

See [SCALING_STRATEGY.md](./SCALING_STRATEGY.md).

---

## Cross-links

- [TARGET_PERFORMANCE_ARCHITECTURE.md](./TARGET_PERFORMANCE_ARCHITECTURE.md)
- [docs/PRODUCTION_DEPLOYMENT_GUIDE.md](../PRODUCTION_DEPLOYMENT_GUIDE.md)
