# Data Transition Strategy (legacy → Accounting V2)

No historical migration executes in Phase 2. This is the binding plan for Phases 3–9.

## Table inventory

| Category | Tables |
|---|---|
| Legacy financial (preserved, read via adapters) | `Transaction`, `TransactionLine`, `JournalEntry`, `JournalEntryLine`, `Account` (stored `balance` demoted to cache later), `AccountBalance`, `AccountBalanceHistory`, `EquityAccount`, `AccountingPeriod`, `Liability` |
| New V2 | `AcctV2EventRegistry`, `AcctV2Configuration`, `AcctV2FeatureFlag`, `AcctV2PostingAttempt`, `AcctV2Outbox`, `AcctV2ShadowJournal(+Line)`, `AcctV2ShadowComparison`; Phase 5 adds canonical journal tables |
| Shared | `AuditLog` (extended, append-only), `AccountingPeriod` until Phase 8 replaces it |
| Compatibility columns | none needed yet — V2 links to legacy via `legacyTransactionId` / `journalEntryId` on the registry rather than adding columns to legacy tables |

## Record ownership & versioning

Every V2 row carries `architectureVersion` (`LEGACY_V1`/`TRANSITION_V2`/`ACCOUNTING_V2`).
Historical rows adopted during Phase 6 get registry entries with `sourceModule: MIGRATION`
and their original source identity, so provenance is never ambiguous.

## Prerequisites before historical migration (Phase 6)

1. **Duplicate cleanup**: resolve Phase 1 duplicate groups (JRN-006 findings, header-amount
   JRN-009 journals) — decisions recorded per group, reversals not deletions.
2. **Account mapping**: Phase 3 mapping registry complete; every historical posting resolvable
   to a surviving account.
3. **Period assignment**: Phase 8 calendar backfilled; every historical journal date covered
   by exactly one period (fix overlaps/gaps first).
4. **Source linkage**: unmatched operational records (AR-002/AP-002 CSVs) adjudicated.

## Rollout sequence (per business, per module)

1. LEGACY (today) → 2. registry observation (LEGACY + coordinator wiring, Phase 9)
→ 3. SHADOW (comparisons reviewed against thresholds) → 4. DUAL_COMPARE (isolated persisted
output) → 5. NEW_ENGINE for the module with legacy posting disabled for the same events
→ 6. report switch (Phase 7 flags) → 7. legacy decommission.

## Cutover & rollback

See `ACCOUNTING_CUTOVER_STRATEGY.md`. Rollback at any stage = flip flags back to LEGACY;
V2 tables are additive so nothing needs restoring. Legacy decommission criteria: 100% of
active businesses on NEW_ENGINE for ≥ 2 closed periods, shadow/dual variance zero, Phase 6
reconciliation signed off — only then may legacy tables be archived (never dropped in place).

## Acceptance thresholds (entering NEW_ENGINE per module)

- ≥ 99.5% EXACT_MATCH across ≥ 30 days of shadow volume, and 100% on the final 7 days
- zero CRITICAL comparison findings outstanding
- zero cross-tenant/architecture (ARCH-*, TEN-*) findings
- performance within agreed budgets (posting p95 < 500 ms)
