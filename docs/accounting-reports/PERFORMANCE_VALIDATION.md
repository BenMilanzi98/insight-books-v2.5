# Performance Validation

## Design for scale

- **Database aggregation**: canonical totals come from two grouped
  aggregations (legacy `TransactionLine` sum-grouped by account; V2
  `AcctV2JournalLine` sum-grouped by account) per window — never per-account
  queries, never journal lines loaded into memory for statements
  (`getCanonicalAccountTotals`).
- A full ledger summary costs a bounded number of grouped queries (opening +
  period windows) regardless of account count — no N+1.
- Statements reuse ledger summaries across sections; the Balance Sheet's two
  windows (all-time + FY) are two summary calls, not per-line queries.
- Indexes: Phase 5/7 migrations index journal lines by (tenant, account,
  date) paths and the new report tables by (tenant, type, generatedAt),
  (tenant, status) and the cache unique key.
- The read-through cache (version-fingerprint freshness) removes repeated
  generation cost for unchanged data; rebuilds are business-scoped only.
- Exports stream from the completed envelope (no re-query); heavy exports are
  bounded by envelope size, not journal volume.
- Client totals are never computed browser-side.

## Validation performed

- The automated suite exercises multi-account, multi-month, two-tenant
  datasets through every report type, drill-down and reconciliation — timing
  stays milliseconds in-process.
- Production-like benchmarking (large journal volumes on PostgreSQL with
  `EXPLAIN ANALYZE` on the two grouped aggregations) is the Stage 2 rollout
  gate; the queries are standard grouped sums over indexed columns, and the
  benchmark checklist lives in CONTROLLED_ROLLOUT.md.

## Known follow-ups

Async/queued generation with progress reporting for very large PDF/Excel
packs, and materialized period summaries if Stage 2 shows need — both fit
behind the existing facade without contract changes.
