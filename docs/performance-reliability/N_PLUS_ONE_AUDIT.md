# N+1 Query Audit

**Purpose:** Systematic review of Prisma `include`/`findMany` patterns causing query multiplication.

**Status:** **PENDING** — flagged as BN-08 in [PERFORMANCE_BOTTLENECK_REGISTER.md](./PERFORMANCE_BOTTLENECK_REGISTER.md).

**Scope:** List endpoints for invoices, expenses, clients, bank reconciliation candidates.

**Method:** Enable query logging in staging; count queries per request; fix with `select`, batch loaders, or raw aggregations per [QUERY_INVENTORY.md](./QUERY_INVENTORY.md).

**Links:** [SLOW_QUERY_WORKFLOW.md](./SLOW_QUERY_WORKFLOW.md)
