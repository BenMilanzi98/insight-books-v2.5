# Final Phase 5 Report — Journal Entry and General Ledger Reimplementation

Date: 2026-07-20. Status: **COMPLETE**. All workstreams in `PHASE_5_TASKS.md`
delivered; all tests passing; migration deployed and validated; production
build clean.

## What Phase 5 established

1. **One canonical journal structure.** The shared `JournalEntry`/
   `JournalEntryLine` store, finalized with reversal lineage columns and
   `sourceNumber` (additive only). Full source lineage journal ↔ accounting
   event ↔ source document in both directions.
2. **Immutability enforced at the database.** Posted journals cannot be
   deleted (any architecture); posted V2 journals and their lines have frozen
   financial columns and forward-only status transitions — validated live
   against the deployed triggers.
3. **The GL is now a derived query service, not a record.**
   `canonicalJournalSource` defines the single authority rule (posted
   transactions ∪ posted non-mirror journal entries); `ledgerQueryService`
   computes opening/movement/closing/running balances, normal-balance
   presentation and hierarchy from it. No surface reads `Account.balance` or
   operational tables.
4. **Read-model decision.** Direct indexed canonical queries are
   authoritative; `AcctV2LedgerBalance` is a versioned, rebuildable,
   non-authoritative monthly summary cache with validate-before-swap rebuilds.
5. **Full V2 reversal workflow.** `REVERSAL_JOURNAL` template through the
   posting engine: approval-gated, idempotent, atomic bidirectional linking,
   `REV` numbering; repeated requests replay instead of double-reversing.
6. **Reconciliation and integrity monitoring.** JRN-101…110 / GL-110…118 rule
   catalogue; reconciliation compares canonical lines vs stored balances vs
   projection vs legacy trial balance and reports measured findings, never
   auto-corrects.
7. **APIs, UI, exports.** Six ledger routes + reversal actions, all
   permission-guarded and business-scoped; GL V2 page; CSV exports sharing the
   screen's query contract with formula-injection protection.
8. **Legacy defect fixed.** GL export double-counting of mirrored journals
   (P5-I01) — export now applies the same `transactionId: null` rule as the
   screen.

## Verification evidence

| Check | Result |
| --- | --- |
| Phase 5 suite `test/accountingV2.ledger.test.js` | 36/36 passing |
| Phase 4 engine suite | 48/48 passing |
| Architecture boundary suite | 10/10 passing (extended: reversal linkage moved into the approved journal writer after the boundary test caught it in the engine) |
| `prisma migrate status` | Schema up to date, no drift |
| DB trigger validation (live, rolled back) | All six immutability cases behave as specified (`MIGRATION_VALIDATION.md`) |
| `npm run build` | Production build succeeds |

Pre-existing failures elsewhere in the repo's test suite (8 tests across
UI-helper/report-rollup files such as `journalAccountSelect`,
`incomeStatementOperating*`, plus three suites that fail at import) are
untouched by Phase 5 code — none import the Phase 5 modules — and were
failing for unrelated reasons (label-format drift, empty suite files).

## Explicitly deferred

- Historical repair (header-amount journals, duplicates, cache drift) →
  Phase 6 (`PHASE_6_READINESS.md`).
- Trial balance / financial statement rewrite → Phase 7
  (`PHASE_7_READINESS.md`).
- Legacy journal UI replacement → cutover stage (flag-gated).
- Legacy `LEGACY_V1` DB update-trigger → Phase 6, with the account-merge flow.
- AR/AP subledger reimplementation → Phase 9.

## Risk notes

- Dual write paths persist by design until Phase 9; the canonical union
  absorbs both, and the legacy-new posting guard prevents double posting.
- The projection is safe to lose at any time (rebuildable, non-authoritative).
- Reversal of *legacy* journals still flows through the legacy reversal
  service; the V2 workflow rejects them explicitly rather than guessing.
