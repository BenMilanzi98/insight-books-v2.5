# Observability Dashboards

Dashboard specifications for operators. **Implementation pending** tooling choice.

---

## Dashboard 1 — Platform overview

| Panel | Query / source |
|---|---|
| Request rate | `rate(http_requests_total[5m])` |
| Error rate | 5xx / total |
| p95 latency | `histogram_quantile(0.95, http_request_duration_seconds)` |
| Ready probe | `health_ready` |

---

## Dashboard 2 — Accounting health

| Panel | Source |
|---|---|
| Posting rate & p95 | `posting_*` metrics |
| Duplicate postings | `duplicate_posting_total` (alert if > 0) |
| Report cache hit ratio | `cache_hit` label on report metrics |
| Outbox backlog | `outbox_pending_count` |

---

## Dashboard 3 — Database

| Panel | Source |
|---|---|
| Active connections | `db_connections_active` vs max |
| Pool waiting | `db_pool_waiting` |
| Top queries | pg_stat_statements export |
| Buffer hit ratio | PG exporter |

---

## Dashboard 4 — Tenant fairness

| Panel | Source |
|---|---|
| p95 by tenant decile | Aggregated tenant latency |
| Throttle events | `tenant_throttled_total` |

---

## Access

- Ops: all dashboards
- Dev: staging only
- No PII in dashboard variables

---

## Cross-links

- [ALERTING.md](./ALERTING.md)
- [OPERATIONAL_RUNBOOKS.md](./OPERATIONAL_RUNBOOKS.md)
