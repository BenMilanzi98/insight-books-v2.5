# Stress Test Plan

Find breaking points beyond steady load ([LOAD_TEST_PLAN.md](./LOAD_TEST_PLAN.md)).

---

## Objectives

- Identify first failure mode (CPU, pool, locks, disk)
- Validate [BACKPRESSURE.md](./BACKPRESSURE.md) and 503 behavior
- Confirm no correctness violations at collapse

---

## Method

1. Start at L1 steady RPS from load plan
2. Ramp +10% every 5 minutes until:
   - Error rate > 5% for 2 min, OR
   - p99 > 3× draft SLO for 2 min, OR
   - DB `too many clients`

3. Hold 5 min at breaking point (staging only)
4. Ramp down — verify recovery without manual DB intervention

---

## Scenarios

| ID | Focus | Knob |
|---|---|---|
| S1 | Posting storm | CP-01 only, increasing VUs |
| S2 | Report storm | CP-12 cold cache |
| S3 | Connection limit | Many parallel long reports |
| S4 | Cron + peak overlap | Trigger cron during S1 |

---

## Record

| Field | Value |
|---|---|
| Max RPS before failure | MEASURED at run time |
| First saturated resource | MEASURED |
| duplicate_posting_count | Must be 0 |

Update [PERFORMANCE_BOTTLENECK_REGISTER.md](./PERFORMANCE_BOTTLENECK_REGISTER.md).

---

## Cross-links

- [SOAK_TEST_PLAN.md](./SOAK_TEST_PLAN.md)
- [DATA_CONSISTENCY_UNDER_LOAD.md](./DATA_CONSISTENCY_UNDER_LOAD.md)
