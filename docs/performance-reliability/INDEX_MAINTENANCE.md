# Index Maintenance

**Purpose:** PostgreSQL index bloat and rebuild policy for 554-index schema.

**Activities:** `REINDEX` (concurrent where supported), autovacuum tuning, monitor bloat on `JournalEntryLine`, `AcctV2ReportCache`.

**Status:** PENDING runbook execution on staging.

**Caution:** Reindex during low traffic; coordinate with [GRACEFUL_SHUTDOWN.md](./GRACEFUL_SHUTDOWN.md).

**Links:** [INDEX_REVIEW.md](./INDEX_REVIEW.md), [DATABASE_OBSERVABILITY.md](./DATABASE_OBSERVABILITY.md)
