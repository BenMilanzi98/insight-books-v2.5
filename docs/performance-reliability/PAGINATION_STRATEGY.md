# Pagination Strategy

**Purpose:** Document bounded page sizes across API routes to protect memory and latency.

**Verified (Phase 5):** Account activity pages capped at **500 lines**; journal explorer paginates DB-side; integrity scans cap at **5000** journals/run ([accounting-ledger/PERFORMANCE_VALIDATION.md](../accounting-ledger/PERFORMANCE_VALIDATION.md)).

**Status:** DESIGNED for ledger; **PENDING** inventory for remaining list endpoints.

**Policy:** Default page size ≤ 50 for UI lists; max hard cap enforced server-side; cursor/keyset preferred for large tables (future).

**Links:** [QUERY_INVENTORY.md](./QUERY_INVENTORY.md), [WORKLOAD_MODEL.md](./WORKLOAD_MODEL.md)
