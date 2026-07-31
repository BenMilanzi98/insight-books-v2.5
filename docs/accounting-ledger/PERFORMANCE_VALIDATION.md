# Phase 5 Performance Notes

## Query strategy

- **Balances never enumerate lines.** Opening balances, period movements and
  summary totals use DB-side `groupBy` sums over the canonical `where`
  clauses; only account drill-downs load lines, and only for the requested
  account's merge group and window.
- **All aggregation is integer minor units** — one conversion per Decimal, no
  float accumulation, no post-hoc rounding passes.
- **Pagination is bounded**: account activity pages are capped at 500 lines;
  the journal explorer paginates DB-side; integrity checks cap the scanned
  journal set (`limit`, default 5000) per run.
- **Projection acceleration**: trial-balance-shaped summary queries can be
  served from `AcctV2LedgerBalance` (monthly cells, versioned) when the
  `accountingV2LedgerProjection` flag is on; authority remains with the
  canonical query either way.
- **Rebuild memory**: the projection rebuild aggregates month by month with
  DB-side sums, so memory stays bounded regardless of history size.

## Indexes supporting the canonical paths

| Query | Index |
| --- | --- |
| Posted journals per tenant/status | `JournalEntry (tenantId, architectureVersion, status)` |
| Date-windowed journals | `JournalEntry (tenantId, postingDate)`, `entryDate` index |
| Source lineage lookups | `JournalEntry (tenantId, sourceType, sourceId)` |
| Reversal pairs | `JournalEntry (originalJournalId)`, `(reversedByJournalId)` |
| Entry-type filters (Reversal, Adjustment…) | `JournalEntry (tenantId, entryType)` (Phase 5) |
| Line rollups per account | `JournalEntryLine (accountId)`, `TransactionLine (accountId)` |
| Transactions per tenant/date/status | `Transaction (tenantId)`, `(date)`, `(status)`, `(branchId)` |
| Projection reads | `AcctV2LedgerBalance (tenantId, projectionVersion)` unique cell key |

## Known trade-off

Account drill-down computes running balances over the full requested window
before slicing the page (correct page-to-page carry, defect P5-I04 fix). For
very large windows on very active accounts, narrow the date window — the API
caps page size, and the summary endpoints never take this path. If a tenant
outgrows this, the documented follow-up is windowed running-balance
checkpoints derived from the projection (still non-authoritative).
