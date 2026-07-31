# Idempotency Under Load

**Purpose:** Ensure retry and concurrent post storms never duplicate journals.

**Mechanism:** `AcctV2EventRegistry` unique keys; posting engine maps P2002 to idempotent outcomes ([LOCKING_AND_CONCURRENCY_MODEL.md](./LOCKING_AND_CONCURRENCY_MODEL.md)).

**Verification:** [DATA_CONSISTENCY_UNDER_LOAD.md](./DATA_CONSISTENCY_UNDER_LOAD.md) DC-01; `duplicate_posting_total` SLI must stay 0.

**Policy:** [ERROR_BUDGET_POLICY.md](./ERROR_BUDGET_POLICY.md) — zero tolerance.

**Tests:** `test/accountingV2.postingEngine.test.js`; load test parallel same-key scenario **PENDING**.

**Links:** [RETRY_POLICY.md](./RETRY_POLICY.md)
