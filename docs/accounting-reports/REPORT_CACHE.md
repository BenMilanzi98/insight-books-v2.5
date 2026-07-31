# Report Cache

`lib/accountingV2/reporting/reportCacheService.js`; table `AcctV2ReportCache`;
maintenance API `POST /api/accounting-v2/reports/cache` (permission
`reports.rebuildCache`); flag `acctv2_report_cache_v2`.

## Model

Read-through cache keyed by `(tenantId, reportType, filtersHash,
definitionVersion)`. Each entry stores the full envelope payload, the
`sourceDataVersion` (accounting-data fingerprint at build time) and `builtAt`.

## Freshness — version comparison, not TTL

On every read the current accounting data version is recomputed (latest
legacy/V2 posting timestamps + row counts, business-scoped). If it differs
from the entry's `sourceDataVersion`, the entry is stale and the report is
regenerated and re-stored. This automatically invalidates after journal
posting, reversals, adjustments and approved historical repairs (any of which
change the fingerprint). Mapping changes are covered by the definition version
in the key. A served cache hit is marked `fromCache: true` with its data
version — a stale entry is never served, so stale data can never be presented
as verified.

## Guarantees

- The General Ledger remains authoritative; the cache is a convenience copy.
- Business-scoped keys; the API validates business access before touching it.
- `rebuildReportCache` deletes entries for one business (optionally one report
  type) — never a full-platform rebuild.
- `reconcileReportCache` (REP-030) regenerates canonically and compares
  checksums per entry, reporting MATCH / STALE / MISMATCH.

Tested: hit/rebuild-on-change, invalidation after posting, rebuild scoping,
reconciliation mismatch detection, and tenant isolation of cache keys.
