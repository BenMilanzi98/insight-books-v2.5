# Circuit Breaker Policy

**Purpose:** Fail fast when downstream dependencies (DB, email, payments) are unhealthy.

**Current:** No centralized circuit breaker library in repo; DB failures surface as 503/500 per route.

**Target (DRAFT):** Breaker on external HTTP clients; open after 5 failures / 30s; half-open probe.

**Status:** NOT IMPLEMENTED — use [BACKPRESSURE.md](./BACKPRESSURE.md) pool shedding first.

**Links:** [RETRY_POLICY.md](./RETRY_POLICY.md), [TIMEOUT_POLICY.md](./TIMEOUT_POLICY.md)
