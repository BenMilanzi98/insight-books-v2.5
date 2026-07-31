# Required Metrics

Minimum metric catalogue for Phase 17. Emit from `lib/performanceReliability/` where noted.

---

## HTTP (RED)

| Metric | Type | Labels |
|---|---|---|
| `http_requests_total` | Counter | `method`, `route`, `status` |
| `http_request_duration_seconds` | Histogram | `method`, `route` |

---

## Accounting critical paths

| Metric | Type | Labels |
|---|---|---|
| `posting_duration_seconds` | Histogram | `source_type`, `outcome` |
| `posting_total` | Counter | `source_type`, `outcome` |
| `report_generate_duration_seconds` | Histogram | `report_type`, `cache_hit` |
| `duplicate_posting_total` | Counter | **must always be 0** |

---

## Database

| Metric | Type | Labels |
|---|---|---|
| `db_pool_waiting` | Gauge | — |
| `db_query_duration_seconds` | Histogram | `operation` (optional) |
| `db_connections_active` | Gauge | — |

---

## Reliability

| Metric | Type | Labels |
|---|---|---|
| `health_ready` | Gauge | 0/1 |
| `outbox_pending_count` | Gauge | — |
| `rate_limit_rejected_total` | Counter | `route` |
| `tenant_throttled_total` | Counter | `tenant_id` (hashed) |

---

## Runtime

| Metric | Type |
|---|---|
| `nodejs_event_loop_lag_seconds` | Gauge |
| `process_resident_memory_bytes` | Gauge |

---

## Cardinality rules

- Normalize route paths (`/api/accounting-v2/journals/[id]` not raw IDs)
- Do not label high-cardinality user IDs on every metric

---

## Cross-links

- [SERVICE_LEVEL_INDICATORS.md](./SERVICE_LEVEL_INDICATORS.md)
- [PERFORMANCE_REGRESSION_GATES.md](./PERFORMANCE_REGRESSION_GATES.md)
