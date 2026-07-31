# Operational Runbooks

Symptom → diagnosis → action. Detailed DR: [DISASTER_RECOVERY_RUNBOOK.md](./DISASTER_RECOVERY_RUNBOOK.md).

---

## RB-01 — Site down / 502

| Step | Action |
|---|---|
| 1 | Check `/api/system/live` and `/ready` |
| 2 | `pm2 status` or `docker compose ps` |
| 3 | Review app logs for crash loop |
| 4 | Restart app; if DB fail → RB-02 |

---

## RB-02 — Database unavailable

| Step | Action |
|---|---|
| 1 | `pg_isready` / compose db health |
| 2 | Check disk space on DB volume |
| 3 | Review PG logs for corruption |
| 4 | Restore from backup if needed — [DISASTER_RECOVERY_RUNBOOK.md](./DISASTER_RECOVERY_RUNBOOK.md) |

---

## RB-03 — Slow reports

| Step | Action |
|---|---|
| 1 | Check cache hit ratio |
| 2 | Identify tenant + report type from metrics |
| 3 | `EXPLAIN` per [QUERY_INVENTORY.md](./QUERY_INVENTORY.md) |
| 4 | Temporary: rebuild cache for business |

---

## RB-04 — Posting failures spike

| Step | Action |
|---|---|
| 1 | Check period closed? validation errors? |
| 2 | DB locks / deadlocks in `pg_stat_activity` |
| 3 | **If duplicate_posting alert** → SEV-1, freeze deploys |
| 4 | Review [DATA_CONSISTENCY_UNDER_LOAD.md](./DATA_CONSISTENCY_UNDER_LOAD.md) |

---

## RB-05 — Connection pool exhausted

| Step | Action |
|---|---|
| 1 | Count processes × pool size — [CONNECTION_POOL_MANAGEMENT.md](./CONNECTION_POOL_MANAGEMENT.md) |
| 2 | Reduce PM2 instances or lower `connection_limit` |
| 3 | Kill idle long transactions |

---

## RB-06 — Outbox backlog

| Step | Action |
|---|---|
| 1 | Query pending `AcctV2OutboxMessage` count |
| 2 | Dispatcher not implemented — manual triage or defer notifications |
| 3 | Monitor ARCH-005 in integrity audit |

---

## RB-07 — Rate limit false positives

| Step | Action |
|---|---|
| 1 | Confirm single-node vs cluster (in-memory limit) |
| 2 | Adjust limit or migrate to shared store |
| 3 | See [API_RATE_LIMITING.md](./API_RATE_LIMITING.md) |

---

## RB-08 — Deploy rollback

See [ROLLBACK_STRATEGY.md](./ROLLBACK_STRATEGY.md).

---

## Cross-links

- [HEALTH_CHECKS.md](./HEALTH_CHECKS.md)
- [ALERTING.md](./ALERTING.md)
