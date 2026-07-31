# Cache Architecture

Caching layers in InsightBooks V2. **Financial truth remains the general ledger** — caches are convenience copies only.

---

## Layers

| Layer | Technology | Scope | Authority |
|---|---|---|---|
| Report cache | PostgreSQL `AcctV2ReportCache` | Tenant + business + report type + filters hash | **Non-authoritative** |
| Ledger projection | `AcctV2LedgerBalance` (optional flag) | Monthly cells per account | **Non-authoritative** — canonical query wins |
| Next.js static | Build output / CDN (future) | Public assets | N/A |
| In-memory | None for financial data today | — | — |
| Redis | **Not present** | — | — |

---

## Report cache (`AcctV2ReportCache`)

**Implementation:** `lib/accountingV2/reporting/reportCacheService.js`

**Key shape:**

```
(tenantId, reportType, filtersHash, definitionVersion)
```

**Invalidation:** Compare `sourceDataVersion` fingerprint to live accounting data — not TTL-based. Stale entries are regenerated, never served.

**Guarantees** (from Phase 7):

- Business-scoped keys; API validates access
- `rebuildReportCache` deletes per business — never platform-wide
- REP-030 reconciliation detects MISMATCH

Full spec: [accounting-reports/REPORT_CACHE.md](../accounting-reports/REPORT_CACHE.md).

---

## Tenant scoping rules

1. Every cache key **must** include `tenantId` (and business scope where applicable)
2. Cross-tenant cache read = security incident ([ERROR_BUDGET_POLICY.md](./ERROR_BUDGET_POLICY.md))
3. Load tests must include multi-tenant isolation checks

---

## What we never cache

- Raw journal mutation results
- Posting idempotency decisions
- Period closed/open authority
- User permission outcomes (beyond HTTP standard cache-control on static assets)

---

## Performance notes

| Scenario | Behavior |
|---|---|
| Cache hit | Skip heavy aggregation — mark `fromCache: true` |
| Cache miss | Full canonical generation + store |
| Posting | Fingerprint changes → next read misses cache automatically |

---

## Future (target architecture)

- Optional process-local LRU for **same-request** deduplication only
- Redis for rate limits and session — **not** for GL balances

See [TARGET_PERFORMANCE_ARCHITECTURE.md](./TARGET_PERFORMANCE_ARCHITECTURE.md).

---

## Cross-links

- [MATERIALIZED_PROJECTION_STRATEGY.md](./MATERIALIZED_PROJECTION_STRATEGY.md)
- [DATA_CONSISTENCY_UNDER_LOAD.md](./DATA_CONSISTENCY_UNDER_LOAD.md)
