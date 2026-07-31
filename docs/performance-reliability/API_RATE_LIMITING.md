# API Rate Limiting

**Purpose:** Protect auth and abuse-sensitive routes.

**Current:** In-memory sliding window in `lib/securityGovernance/domain/rateLimit.js`; login route wired; **not cluster-safe**.

**Limits (defaults):** 20 req / 60s per key unless configured.

**Target:** Redis or edge limiter when N > 1 app instance.

**Status:** Partial — see [CURRENT_PERFORMANCE_ARCHITECTURE.md](./CURRENT_PERFORMANCE_ARCHITECTURE.md).

**Links:** [BACKPRESSURE.md](./BACKPRESSURE.md), [TENANT_FAIRNESS.md](./TENANT_FAIRNESS.md)
