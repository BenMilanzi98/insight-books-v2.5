# Performance Validation

## Design for performance

- Indexed lookups: `(tenantId, startDate/endDate)` on years and periods,
  `(tenantId, status)`, `(tenantId, code)`; the resolver fetches at most one
  year and its covering periods per posting — never a platform-wide scan.
- Calendar rows are small and immutable once created; the resolver performs
  two indexed queries per posting (year, covering periods).
- Close checks run per rule against canonical services; no full journal load
  into memory. Automated checks batch through the existing report engine
  which paginates and aggregates in SQL.
- Snapshot generation happens inside the closure transaction using the
  Phase 7 cached report runs — no external API calls inside the transaction.
- Period activity endpoints paginate; the UI loads detail per period, not
  all periods' runs at once.

## Measured (test-suite scale)

The 44-test suite, including two full close cycles and a reopen/re-close
cycle, executes in ~0.3 s against the in-memory stub — resolution and
close-check logic is O(periods-in-year) per call. Production benchmarks with
real volumes are the standing Phase 9 rollout task: measure
`resolvePeriodV2` latency under posting load and close-run duration per
business before enabling `STRICT_POSTING` broadly.

## Avoided anti-patterns

Global calendar caches without business scope, one giant close transaction
covering all checks (only the final closure is transactional), client-side
close validation, and per-posting scans of all periods.
