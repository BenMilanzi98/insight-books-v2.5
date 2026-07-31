# Phase 7 Readiness — Trial Balance and Financial Reporting Rewrite

Phase 7 (reporting) can now be built entirely on the Phase 5 query layer. The
contracts below are what Phase 7 consumes; no report should ever query journal
tables directly again.

## Contracts available

| Need | Contract |
| --- | --- |
| Authoritative posted lines | `canonicalJournalSource` — one union, one mirror-exclusion rule, integer minor units |
| Per-account totals for any window | `getCanonicalAccountTotals` (DB-side sums) |
| Opening / movement / closing per account | `getBusinessLedgerSummary` (merge rollup, normal balance, abnormal flags, balanced totals) |
| Hierarchy/rollup presentation | `getLedgerHierarchy` (presentation-only parents) |
| Account drill-down with running balances | `getAccountLedger` |
| Journal browsing + lineage | `journalQueryService` |
| Normal-balance presentation | `resolveNormalBalance` / `presentBalance` (configuration-driven, never code ranges) |
| Fast monthly summaries | `AcctV2LedgerBalance` projection (non-authoritative, versioned, rebuildable) |
| Correctness proofs | Reconciliation service + integrity rules |

## Trial balance construction (Phase 7 recipe)

TB for `[start, end]` = per-account `getBusinessLedgerSummary`: opening from
canonical activity before `start`, movement from raw period debits/credits,
closing = opening + debits − credits; grand totals must balance (GL-112 backs
this). The legacy `trialBalanceReport` float pipeline is replaced, not
patched; the reconciliation service already compares the two during
transition (1-cent tolerance on the legacy side).

## Known blockers / cautions for Phase 7

1. **Header-amount journals** are excluded from canonical totals (JRN-104).
   Reports built on the canonical source will match the current official
   surfaces (which also exclude them), but any expectation that these rows
   "should" be included must wait for Phase 6 repair.
2. **Legacy float drift**: legacy TB uses JavaScript floats; cent-level
   differences from the canonical integer math are expected and documented,
   not report bugs.
3. **Dual write paths remain** until Phase 9; reports must keep sourcing from
   the canonical union, not from `architectureVersion` filters.
4. **`Account.balance` and `AccountBalance`** remain drifting caches until
   Phase 6 retires them; no report may read them (ADR-011, GL-118).
5. **AR/AP aging and cash-flow services** still bypass the GL (Phase 1
   finding); their re-derivation is Phase 7/9 scope, with subledger
   reconciliation contracts to be defined against control accounts.
6. **Multi-currency**: reports present base currency; foreign-currency detail
   exists on V2 lines only. Historical legacy rows have no reliable
   transaction-currency data — reports must not pretend otherwise.

## Ready-to-use quality gates

- GL-112 (debits = credits) as a hard gate on every generated statement.
- Reconciliation runs before/after report-engine cutover per business.
- Architecture tests extendable to forbid report modules importing legacy
  ledger internals.
