# Batch Processing Strategy

**Purpose:** Off-peak and chunked processing for rebuilds, imports, and cron workloads.

**Current:** Cron HTTP routes under `app/api/cron/*` with `CRON_SECRET`; ledger rebuild and cache reconcile are admin-triggered.

**Status:** PENDING unified batch framework; today ad hoc per module.

**Guidelines:** Idempotent handlers; chunk size tuned via [QUERY_INVENTORY.md](./QUERY_INVENTORY.md); never batch across tenant boundaries without scoping.

**Links:** [ASYNC_AND_OUTBOX_PROCESSING.md](./ASYNC_AND_OUTBOX_PROCESSING.md), [LOAD_TEST_PLAN.md](./LOAD_TEST_PLAN.md)
