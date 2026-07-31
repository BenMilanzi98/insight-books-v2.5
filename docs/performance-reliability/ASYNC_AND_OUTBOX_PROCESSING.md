# Async and Outbox Processing

**Purpose:** Background work after commit via transactional outbox.

**Current:** `lib/accountingV2/infrastructure/outbox.js` enqueues in same DB transaction as posting; **no dispatcher worker found** in repo (P2-06, ARCH-005).

**Target:** Cron route or worker consuming `fetchPendingOutboxBatch` with [RETRY_POLICY.md](./RETRY_POLICY.md).

**Status:** Enqueue DONE; dispatch **NOT STARTED**.

**Links:** [accounting-posting-engine/TRANSACTIONAL_OUTBOX.md](../accounting-posting-engine/TRANSACTIONAL_OUTBOX.md), [RELIABILITY_RISK_REGISTER.md](./RELIABILITY_RISK_REGISTER.md) PR-03
