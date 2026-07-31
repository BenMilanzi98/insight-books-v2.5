# Materialized Projection Strategy

**Purpose:** Non-authoritative accelerators for ledger/report reads.

**Current:** `AcctV2LedgerBalance` monthly cells when `accountingV2LedgerProjection` flag on; canonical query remains source of truth.

**Rules:** Projections rebuilt off-peak; mismatch → fall back to canonical; never write financial truth from projection alone.

**Status:** DESIGNED (Phase 5); perf comparison **PENDING** in [QUERY_INVENTORY.md](./QUERY_INVENTORY.md).

**Links:** [CACHE_ARCHITECTURE.md](./CACHE_ARCHITECTURE.md), [accounting-ledger/PERFORMANCE_VALIDATION.md](../accounting-ledger/PERFORMANCE_VALIDATION.md)
