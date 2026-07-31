# Rollback Strategy

Rollback is flag-driven and non-destructive.

## Procedure

1. Disable the V2 report flags for the affected business (or globally):
   `acctv2_financial_reports_v2`, `acctv2_trial_balance_v2`, exports,
   drill-down, cache, dashboard flags. Reads immediately return to the legacy
   `/reports` stack, which was never modified.
2. Leave the three Phase 7 tables in place — report definitions (code),
   snapshots and run audit history are preserved.
3. Optionally clear cache entries (`rebuildReportCache`) so no V2 payloads
   linger.
4. If code must be reverted, redeploy the prior build; the additive migration
   may remain (unused tables are harmless) or be dropped explicitly.

## Rollback must not — and cannot, by construction

- **Delete posted journals** — the engine never writes journals.
- **Modify financial values** — report generation is read-only.
- **Delete approved snapshots** — snapshots are only superseded, never
  deleted; rollback does not touch them.
- **Hide accounting exceptions** — the Phase 6 exception register is
  independent of the reporting flags.
- **Create correcting journals** — no code path in the reporting engine
  posts.

## Re-enable

Re-enabling the flags requires no data repair: the first generation after
re-enable recomputes from the canonical GL, and the cache rebuilds itself via
the data-version fingerprint.
