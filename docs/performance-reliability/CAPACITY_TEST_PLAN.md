# Capacity Test Plan

Certify maximum **sustainable** throughput for a defined topology.

---

## Inputs

From [CAPACITY_MODEL.md](./CAPACITY_MODEL.md):

- `num_processes`
- `connection_limit` per process
- PostgreSQL `max_connections`
- Workload mix ([WORKLOAD_MODEL.md](./WORKLOAD_MODEL.md))

---

## Procedure

1. Complete [LOAD_TEST_PLAN.md](./LOAD_TEST_PLAN.md) and [STRESS_TEST_PLAN.md](./STRESS_TEST_PLAN.md)
2. Identify highest RPS where for **30 min**:
   - Error rate < 1%
   - p95 within draft SLO
   - Pool headroom ≥ 10 connections
   - CPU < 85% sustained
3. Document as **certified max sustainable RPS** in [CAPACITY_CERTIFICATION.md](./CAPACITY_CERTIFICATION.md)

---

## Topology matrix (run per deploy shape)

| Topology | Processes | PG max_conn | Certified RPS |
|---|---|---|---|
| Docker single | 1 | 100 | PENDING |
| PM2 × 2 | 2 | 100 | PENDING |
| Target prod | TBD | TBD | PENDING |

**Do not fill RPS until measured.**

---

## Headroom policy

Production should run at ≤ **70%** of certified max (DRAFT) for burst room.

---

## Cross-links

- [COST_AND_CAPACITY_ANALYSIS.md](./COST_AND_CAPACITY_ANALYSIS.md)
- [SCALING_STRATEGY.md](./SCALING_STRATEGY.md)
