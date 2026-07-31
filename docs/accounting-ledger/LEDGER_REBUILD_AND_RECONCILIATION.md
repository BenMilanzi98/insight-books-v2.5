# Ledger Rebuild and Reconciliation

## Rebuild service (`ledgerRebuildService.js`)

Rebuilds the non-authoritative `AcctV2LedgerBalance` monthly summary
projection from the canonical journal source, per business.

Algorithm:

1. Discover the posting-date span of canonical activity for the business.
2. Aggregate month by month with DB-side `groupBy` (bounded memory on any
   history size); zero-activity cells are skipped.
3. **Validate before swap**: whole-window canonical totals per account must
   exactly equal the sums of the freshly built monthly rows (integer minor
   units). Any mismatch aborts the rebuild with the failing accounts listed —
   the previous projection is left untouched.
4. Write all rows under `projectionVersion = previous + 1` and delete older
   versions inside one transaction.
5. Audit the rebuild (`acctv2.ledger.rebuild`) with version, row and month
   counts.

`dryRun: true` performs steps 1–3 and reports what would be written without
touching the table. The rebuild never reads or writes journal tables' data —
journals are its input, never its output.

API: `POST /api/accounting-v2/ledger/rebuild` (permission `ledger.rebuild`),
`GET` returns the active projection version and row counts.

## Reconciliation service (`ledgerReconciliationService.js`)

Read-only. Compares every balance surface against the canonical source and
returns findings; it never mutates financial data. Every run is audited
(`acctv2.ledger.reconciliation`).

| # | Check | Rule | Notes |
| --- | --- | --- | --- |
| 1 | Canonical debits = credits business-wide | GL-112 | Double-entry invariant over the union, any window |
| 2 | Stored `Account.balance` vs canonical derivation | GL-111 | All-time, normal-balance signed to match the cache's convention; each finding states canonical authority (ADR-011) |
| 3 | Projection vs canonical totals | GL-114 | Staleness sentinel; remediation is always "rebuild the projection" |
| 4 | Legacy trial balance vs canonical | GL-115 | Survivor-account rollup, 1-cent tolerance for the legacy float pipeline |
| 5 | Journal structure checks | JRN-1xx | Delegates to the integrity rule engine |

Missing accounts referenced by posted lines are reported as GL-113.

Report shape: window, canonical totals + balanced flag, projection version,
overall status (`HEALTHY` / `DEGRADED` when HIGH findings exist / `CRITICAL`),
severity counts, full findings list with measured amounts, duration.

API: `POST /api/accounting-v2/ledger/reconciliation` (permission
`ledger.reconcile`).

## Discrepancy handling policy

Findings are reported with rule code, severity, affected records and measured
amounts. Nothing is auto-corrected: historical repair is Phase 6 work, and the
canonical journal lines are always stated as the authoritative side of any
disagreement.
