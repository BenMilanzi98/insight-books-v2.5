# Index Review

**Purpose:** Audit 554 `@@index` entries in `prisma/schema.prisma` for write amplification vs read benefit on hot paths.

**Status:** PENDING — prioritize CP-01, CP-10, CP-12 queries from [QUERY_INVENTORY.md](./QUERY_INVENTORY.md).

**Process:**
1. List indexes touched by posting and ledger aggregation
2. EXPLAIN hot queries under [SLOW_QUERY_WORKFLOW.md](./SLOW_QUERY_WORKFLOW.md)
3. Propose adds/drops only with migration rehearsal

**Links:** [DATABASE_OBSERVABILITY.md](./DATABASE_OBSERVABILITY.md), [INDEX_MAINTENANCE.md](./INDEX_MAINTENANCE.md)
