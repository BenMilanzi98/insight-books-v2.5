# Performance Test Environment

**Purpose:** Define staging topology for reproducible load tests.

**Requirements:**
- PostgreSQL 15 matching prod `max_connections` policy
- Node 20, same Next.js build as release candidate
- Seed data per [LOAD_TEST_DATA_STRATEGY.md](./LOAD_TEST_DATA_STRATEGY.md)
- Metrics + health endpoints enabled
- **Not production** — no real customer PII

**Status:** Documented; environment parity **PENDING** verification checklist.

**Links:** [LOAD_TEST_PLAN.md](./LOAD_TEST_PLAN.md), [BASELINE_PERFORMANCE_REPORT.md](./BASELINE_PERFORMANCE_REPORT.md)
