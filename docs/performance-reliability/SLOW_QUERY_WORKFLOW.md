# Slow Query Workflow

**Purpose:** Triage queries exceeding threshold (DRAFT 200ms app, 1s DB).

**Steps:**
1. Identify from metrics or `pg_stat_statements`
2. `EXPLAIN (ANALYZE, BUFFERS)` on staging copy
3. Update [QUERY_INVENTORY.md](./QUERY_INVENTORY.md) entry
4. Re-run load scenario to verify

**Status:** Process defined; **PENDING** first execution pass.

**Links:** [DATABASE_OBSERVABILITY.md](./DATABASE_OBSERVABILITY.md), [INDEX_REVIEW.md](./INDEX_REVIEW.md)
