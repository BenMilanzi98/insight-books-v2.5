# Service Level Indicators (SLIs)

Definitions for measuring service health. Measurement implementation: `lib/performanceReliability/` + [REQUIRED_METRICS.md](./REQUIRED_METRICS.md).

---

## Availability SLIs

| SLI | Definition | Scope |
|---|---|---|
| `availability_ratio` | `(successful probes) / (total probes)` over window | `/api/system/live` |
| `ready_ratio` | Probes where `/ready` returns 200 (DB + critical deps up) | Platform |
| `posting_success_ratio` | Successful CP-01 responses / total CP-01 attempts | Excludes 4xx validation |

---

## Latency SLIs

| SLI | Definition | Histogram buckets (suggested) |
|---|---|---|
| `http_request_duration_seconds` | Wall time API route start → response | 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10 |
| `posting_duration_seconds` | CP-01 only | Same |
| `report_generate_duration_seconds` | CP-12/13 including cache miss path | Same |
| `db_query_duration_seconds` | Prisma middleware (optional) | Same |

Report **p50, p95, p99** per route and tenant decile (anonymized aggregate).

---

## Correctness SLIs

| SLI | Definition |
|---|---|
| `duplicate_posting_count` | Count of second successful posts for same idempotency key — **must stay 0** |
| `cache_stale_served_count` | Reports served where `sourceDataVersion` mismatched — **must stay 0** |
| `cross_tenant_access_count` | Security violations — **must stay 0** |

---

## Saturation SLIs

| SLI | Definition |
|---|---|
| `db_pool_waiting_count` | Requests waiting for connection |
| `db_connections_active` | Active PG connections from app |
| `event_loop_lag_ms` | Node event loop delay |
| `outbox_pending_count` | Rows in pending outbox status |
| `rate_limit_rejected_total` | 429 responses |

---

## Throughput SLIs

| SLI | Definition |
|---|---|
| `http_requests_total` | Counter by route, method, status |
| `postings_total` | Counter by source type |
| `reports_generated_total` | Counter by report type, cache_hit label |

---

## Data collection

| Environment | Method |
|---|---|
| Local / CI | Harness + logs |
| Staging | Metrics endpoint scrape |
| Production | Same + [ALERTING.md](./ALERTING.md) |

**Status:** Instrumentation **IN PROGRESS** — SLI values **NOT CERTIFIED**.

---

## Cross-links

- [SERVICE_LEVEL_OBJECTIVES.md](./SERVICE_LEVEL_OBJECTIVES.md)
- [ERROR_BUDGET_POLICY.md](./ERROR_BUDGET_POLICY.md)
