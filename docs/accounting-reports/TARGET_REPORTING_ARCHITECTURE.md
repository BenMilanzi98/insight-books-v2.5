# Target Reporting Architecture

## Principles

1. **One source of truth.** All amounts derive from canonical posted journal
   lines (Phase 5 `canonicalJournalSource.js`): posted `Transaction` lines plus
   posted `JournalEntry` lines with `transactionId IS NULL` (mirror rows are
   excluded exactly once). Draft, cancelled, failed and shadow journals are
   structurally excluded; reversals are ordinary opposite posted entries.
2. **One engine.** `financialReportService.generateReport` is the single entry
   point for every surface — screen, API, exports, dashboard, reconciliation.
   Screens and exports consume the same completed envelope, so they can never
   diverge (REP-026 by construction).
3. **Explicit mapping.** Statement lines map to accounts through declarative
   rules over Phase 3 classification (`coaV2Category`, `coaV2SubType`,
   `financialStatementSection`, `systemPurpose`, `controlAccountPurpose`,
   `cashFlowClassification`). Name/code heuristics are assist-level fallbacks
   for unclassified legacy accounts and always produce a mapping warning.
4. **Integrity before presentation.** Reports carry an integrity status
   (VERIFIED / VERIFIED_WITH_WARNINGS / UNVERIFIED / BLOCKED). Failing
   equations, material unmapped balances and open Phase 6 exceptions block
   VERIFIED; unverified reports cannot be approved.
5. **Exact arithmetic.** All authoritative values are integer minor units;
   decimal strings are derived at presentation only.
6. **Business scope everywhere.** Every query requires an accounting context;
   the business always comes from the session, never the client.

## Layers

| Layer | Responsibility |
| --- | --- |
| Canonical journal source | Authority rules, posted-only union, date semantics |
| GL query service | Opening/movement/closing per account, normal-balance presentation, merge rollup, header flagging |
| Report contracts | Normalized frozen requests, standard envelope, minor-unit amounts, checksums |
| Definitions + mapping | Versioned immutable templates, first-match single assignment, controlled formulas |
| Generators | TB, IS, BS, CF, Equity, AR/AP aging, module reports, Budget vs Actual |
| Validation | REP-001..REP-040, cross-report reconciliation, unmapped-account control |
| Workflow | Runs, review/approval, immutable snapshots with supersession |
| Cache | Rebuildable, business/scope keyed, source-data-versioned |
| Exports | CSV/Excel/PDF from the completed envelope only |
| APIs + UI | Permissioned routes under `/api/accounting-v2/reports/*`, `/reports-v2` page |

## What the engine never does

- Never reads `Account.balance` / stored balances as truth.
- Never adds operational totals to statement amounts (operational documents
  provide aging *detail* only; totals reconcile to control accounts).
- Never creates journals — report generation is read-only.
- Never inserts plug/balancing figures; differences are disclosed exactly.
- Never double-counts parent/child accounts (headers are presentation-only),
  aliases (merge rollup), Current Year Earnings (single calculated line) or
  legacy/V2 mirrors (transactionId exclusion).
