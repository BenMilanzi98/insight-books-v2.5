# Load Test Plan

Steady-state load testing for InsightBooks V2. **No results until executed** — record in [BASELINE_PERFORMANCE_REPORT.md](./BASELINE_PERFORMANCE_REPORT.md).

---

## Objectives

- Validate draft SLOs under [WORKLOAD_MODEL.md](./WORKLOAD_MODEL.md) SME profile
- Confirm `duplicate_posting_count = 0`
- Measure p95 latency for CP-01, CP-10, CP-12

---

## Tooling

| Tool | Status |
|---|---|
| k6 | **NOT IN REPO** — add under `scripts/load/` or `test/load/` |
| autocannon | Alternative for single-endpoint smoke |

---

## Environment

[PERFORMANCE_TEST_ENVIRONMENT.md](./PERFORMANCE_TEST_ENVIRONMENT.md) — staging with realistic seed ([LOAD_TEST_DATA_STRATEGY.md](./LOAD_TEST_DATA_STRATEGY.md)).

---

## Scenarios

### L1 — SME steady mix (30 min)

| Virtual users | ASSUMED 20 |
|---|---|
| Mix | 55% reads, 20% post, 15% reports, 10% other |
| Auth | Service account per tenant |

**Pass criteria (DRAFT):** error rate < 1%, no duplicate posts, p95 within draft SLO band.

### L2 — Report heavy (15 min)

- 40% traffic: trial balance + P&L generate
- Measure cache warm-up curve

### L3 — Multi-tenant fairness (20 min)

- 2 tenants: one 5× report load, one steady posting
- See [TENANT_FAIRNESS.md](./TENANT_FAIRNESS.md)

---

## Metrics to capture

- k6 `http_req_duration`, `http_req_failed`
- App metrics from [REQUIRED_METRICS.md](./REQUIRED_METRICS.md)
- PG connections, top queries ([DATABASE_OBSERVABILITY.md](./DATABASE_OBSERVABILITY.md))

---

## Safety

- Staging only unless approved change window
- Idempotency keys on all POST scenarios
- No production tenant data without anonymization

---

## Cross-links

- [STRESS_TEST_PLAN.md](./STRESS_TEST_PLAN.md)
- [CAPACITY_TEST_PLAN.md](./CAPACITY_TEST_PLAN.md)
