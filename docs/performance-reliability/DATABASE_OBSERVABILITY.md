# Database Observability

PostgreSQL 15 monitoring for InsightBooks V2. Prisma access via `lib/prisma.js`.

---

## What to monitor

| Signal | Source | Alert threshold (DRAFT) |
|---|---|---|
| Connection count | `pg_stat_activity` | > 80% of `max_connections` |
| Waiting queries | `pg_stat_activity.wait_event_type` | Sustained `Lock` > 30s |
| Buffer hit ratio | `pg_stat_database` | < 95% (investigate) |
| Deadlocks | `pg_stat_database.deadlocks` | Any increment |
| Replication lag | N/A today (no replica) | Future |
| Disk usage | Host / volume metrics | > 80% |
| Long transactions | `pg_stat_activity.xact_start` | > 60s on posting routes |

---

## Enable pg_stat_statements

```sql
-- Requires superuser / RDS parameter group
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

Review cadence: weekly + after each load test. Workflow: [SLOW_QUERY_WORKFLOW.md](./SLOW_QUERY_WORKFLOW.md).

---

## Prisma observability

| Hook | Purpose |
|---|---|
| Prisma `$on('query')` | Dev-only slow query log (> 200ms) |
| Middleware in `lib/performanceReliability/` | Production duration metrics |
| Log level | `error` in prod (`lib/prisma.js`) |

**Do not** log full SQL with tenant PII in production.

---

## Key tables to watch (accounting)

| Table | Watch for |
|---|---|
| `JournalEntry` / `JournalEntryLine` | Seq scans on large tenants |
| `AcctV2ReportCache` | Table bloat, stale entries count |
| `AcctV2OutboxMessage` | Pending backlog (ARCH-005) |
| `AcctV2LedgerBalance` | Projection rebuild duration |

---

## Integrity cross-checks

- `lib/accountingAudit/architectureIntegrityAudit.js` — ARCH-005 outbox
- Ledger reconciliation API — off-peak schedule

---

## Load test artifacts

During [LOAD_TEST_PLAN.md](./LOAD_TEST_PLAN.md):

1. Snapshot `pg_stat_statements` before/after
2. Save EXPLAIN plans to query inventory entries
3. Record connection peak in [BASELINE_PERFORMANCE_REPORT.md](./BASELINE_PERFORMANCE_REPORT.md)

---

## Cross-links

- [CONNECTION_POOL_MANAGEMENT.md](./CONNECTION_POOL_MANAGEMENT.md)
- [LOCKING_AND_CONCURRENCY_MODEL.md](./LOCKING_AND_CONCURRENCY_MODEL.md)
- [INDEX_MAINTENANCE.md](./INDEX_MAINTENANCE.md)
