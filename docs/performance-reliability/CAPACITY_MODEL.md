# Capacity Model

Formulas and certification procedure for InsightBooks V2. **No certified production capacity numbers** — use this document to compute and validate headroom.

---

## Connection capacity

### Formula

```
effective_pool = processes × pool_size_per_process
headroom = max_connections - effective_pool - admin_reserve
```

| Variable | Typical source |
|---|---|
| `processes` | PM2 instances or Docker replica count |
| `pool_size_per_process` | Prisma default (~ `num_cpus * 2 + 1`) unless `connection_limit` set in `DATABASE_URL` |
| `max_connections` | PostgreSQL setting (default 100; may be raised in prod) |
| `admin_reserve` | 5–10 for migrations, `pg_dump`, monitoring |

**Rule:** Require `headroom ≥ 10` before certifying a deployment topology.

See [CONNECTION_POOL_MANAGEMENT.md](./CONNECTION_POOL_MANAGEMENT.md).

---

## Request throughput (theoretical)

```
max_sustainable_rps ≈ min(
  app_cpu_ceiling,
  db_connection_throughput,
  disk_iops_ceiling
)
```

Certify empirically via [CAPACITY_TEST_PLAN.md](./CAPACITY_TEST_PLAN.md) — do not publish a number without measurement.

---

## Posting throughput

Posting is **transaction-bound**:

```
posting_tps_upper ≈ concurrent_db_transactions / avg_posting_tx_duration_sec
```

Variables to measure:

- `avg_posting_tx_duration_sec` — from metrics on CP-01
- Unique constraint contention under parallel posts to same source

Duplicate posting attempts must remain **0** at all load levels ([ERROR_BUDGET_POLICY.md](./ERROR_BUDGET_POLICY.md)).

---

## Report capacity

```
report_qps_cache_hit ≈ limited_by_app_cpu
report_qps_cache_miss ≈ limited_by_db_scan + aggregation_time
```

Cache hit ratio target (DRAFT): see [SERVICE_LEVEL_OBJECTIVES.md](./SERVICE_LEVEL_OBJECTIVES.md).

---

## Storage growth (ASSUMED)

```
journal_lines_per_month ≈ posts_per_month × avg_lines_per_post
storage_gb_per_year ≈ journal_lines × avg_row_bytes × 12 / 1e9
```

Replace ASSUMED inputs from [WORKLOAD_MODEL.md](./WORKLOAD_MODEL.md) with tenant-specific data.

---

## Certification procedure

1. **Configure** target topology (process count, pool limits, PG `max_connections`).
2. **Seed** database per [LOAD_TEST_DATA_STRATEGY.md](./LOAD_TEST_DATA_STRATEGY.md) at SME profile.
3. **Ramp** load in [CAPACITY_TEST_PLAN.md](./CAPACITY_TEST_PLAN.md) until SLI breach or error budget burn.
4. **Record** max sustainable RPS and resource saturation in [CAPACITY_CERTIFICATION.md](./CAPACITY_CERTIFICATION.md).
5. **Sign** or mark **NOT CERTIFIED**.

---

## Cross-links

- [COST_AND_CAPACITY_ANALYSIS.md](./COST_AND_CAPACITY_ANALYSIS.md)
- [SCALING_STRATEGY.md](./SCALING_STRATEGY.md)
