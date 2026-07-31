# Baseline Performance Report

| Field | Value |
|---|---|
| Status | **PENDING MEASUREMENT** |
| Certified numbers | **None** — do not cite this doc for production SLAs until complete |

---

## Purpose

Establish **MEASURED** p50/p95/p99 latency, error rates, and resource saturation for critical paths ([CRITICAL_PATH_INVENTORY.md](./CRITICAL_PATH_INVENTORY.md)) under the SME profile in [WORKLOAD_MODEL.md](./WORKLOAD_MODEL.md).

---

## Prerequisites

1. Staging environment matching [PERFORMANCE_TEST_ENVIRONMENT.md](./PERFORMANCE_TEST_ENVIRONMENT.md)
2. Seed data per [LOAD_TEST_DATA_STRATEGY.md](./LOAD_TEST_DATA_STRATEGY.md)
3. Health + metrics from `lib/performanceReliability/` deployed
4. Load harness (k6 or autocannon) checked into repo

---

## Capture procedure

### 1. Environment snapshot

Record (do not invent):

- Node version, Next.js resolved version, Prisma version
- PostgreSQL version and `max_connections`
- Process count (PM2 / Docker replicas)
- `DATABASE_URL` pool params (redact secrets)
- Dataset row counts: `JournalEntry`, `JournalEntryLine`, tenants

### 2. Warm-up

- 5 minutes steady load at 50% target RPS
- One full report cache warm cycle

### 3. Measurement window

- 30 minutes steady state per [LOAD_TEST_PLAN.md](./LOAD_TEST_PLAN.md)
- Export histograms for SLIs in [SERVICE_LEVEL_INDICATORS.md](./SERVICE_LEVEL_INDICATORS.md)

### 4. Scenarios

| Scenario | Tool | Output |
|---|---|---|
| SME steady mix | k6 | latency percentiles, RPS, error % |
| TB cold cache | k6 | CP-12 miss latency |
| TB warm cache | k6 | CP-12 hit latency |
| Posting burst | k6 | CP-01 p99, duplicate count = 0 |
| Concurrent tenants | k6 | fairness metrics |

### 5. Database side

During test window collect:

- `pg_stat_statements` top 20 by total time
- Active connections vs max
- Checkpoints, buffer hit ratio

See [DATABASE_OBSERVABILITY.md](./DATABASE_OBSERVABILITY.md).

---

## Report template (fill when measured)

```markdown
## Executive summary
- Date:
- Environment:
- Max sustainable RPS (MEASURED):
- Posting p95 (MEASURED):

## Results table
| Path | p50 | p95 | p99 | Error % | Notes |
|------|-----|-----|-----|---------|-------|

## Resource saturation
| Resource | Peak | Limit | Headroom |

## Correctness
| Check | Result |
| duplicate_posting_count | MUST be 0 |

## Recommendations
- Link to QUERY_INVENTORY optimizations
```

---

## Promotion path

1. Complete this report with **MEASURED** labels only on observed values
2. Update [SERVICE_LEVEL_OBJECTIVES.md](./SERVICE_LEVEL_OBJECTIVES.md) targets
3. Sign [CAPACITY_CERTIFICATION.md](./CAPACITY_CERTIFICATION.md) or leave NOT CERTIFIED

---

## Cross-links

- [LOAD_TEST_PLAN.md](./LOAD_TEST_PLAN.md)
- [PERFORMANCE_REGRESSION_GATES.md](./PERFORMANCE_REGRESSION_GATES.md)
