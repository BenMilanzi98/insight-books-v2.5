# Chaos and Failure Injection

**Purpose:** Validate resilience beyond happy-path load tests.

**Existing:** `test/qa/failure-injection/failureInjection.test.js` (Phase 16 QA).

**Planned:** Staging chaos — DB latency injection, process kill mid-post (verify idempotency), cron overlap.

**Status:** Unit-level DONE; staging chaos **PENDING**.

**Links:** [DATA_CONSISTENCY_UNDER_LOAD.md](./DATA_CONSISTENCY_UNDER_LOAD.md), [STRESS_TEST_PLAN.md](./STRESS_TEST_PLAN.md)
