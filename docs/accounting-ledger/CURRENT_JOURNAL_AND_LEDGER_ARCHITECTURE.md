# Current Journal and Ledger Architecture (pre-Phase 5 inventory)

Verified against the repository on 2026-07-20, before any Phase 5 change.

## Models

| Model | Role | Key facts |
| --- | --- | --- |
| `Transaction` + `TransactionLine` | Primary operational GL | Written by `lib/accountingEngine/postGlEntry.js` (status `'posted'`); ~20 caller sites (sales, invoices, payments, expenses, payroll, tax, transfers, assets, capital, opening balances); reversal fields `isReversal`, `reversedTransactionId`, `reversedAt/ById`, `reversalReason`; no unique on `(tenantId, sourceType, sourceId)`; lines cascade on transaction delete |
| `JournalEntry` + `JournalEntryLine` | Manual journals, module mirrors, V2 journals | Legacy header Float `debit`/`credit` columns (header-amount era rows); `transactionId` set = mirror of a Transaction; V2 columns added in Phase 4 (`journalNumber`, totals, period, template, `architectureVersion`, `accountingEventId`); no reversal linkage fields (pre-Phase 5); lines cascade on entry delete; tenant cascade on entry |
| `Account` | CoA | `balance` Decimal snapshot cache; legacy typing (`type`/`accountType`, `normalBalance` free string) + CoA V2 columns (`coaV2Category`, `coaV2NormalBalance`, `coaV2Status`, `postingAllowed`, `hierarchyPath`, `mergedIntoAccountId`, …) |
| `AccountBalance` | Legacy per-code balance cache | Keyed by tenant + account **code string**, Float; used by legacy balance sheet cash section |
| `AccountBalanceHistory` | Period-close snapshots | Float columns |
| V2 tables | Posting engine | `AcctV2EventRegistry` (source-accounting link), `AcctV2ShadowJournal(Line)`, `AcctV2Outbox`, `AcctV2FeatureFlag`, `AcctV2JournalSequence`, `AcctV2OpeningBalanceBatch`; V2 audit uses shared `AuditLog` |

## Write paths

- **Legacy GL**: `postGlEntry` (validates balance, period, duplicate-source
  check, updates `Account.balance`); direct `transaction.create` bypasses in
  `purchaseAccounting.js`, `transactionReversalService.js`, assets/liabilities/
  invoices routes and backfill scripts.
- **Manual journals**: `lib/journalService.js` (`Draft` → `Posted`, `Void`;
  reversal = new Posted JE with `sourceId` = original id, no back-link).
- **Mirrors**: `purchaseAccounting.js` and liability payments write Posted
  `JournalEntry` rows, some with `transactionId` pointing at a Transaction.
- **V2**: Phase 4 engine writes V2 journals through `journalPersistence.js`
  only (guarded, immutable).
- **Hard deletes**: draft-only JE deletion in the journal API; scripts delete
  JEs/Transactions; **no DB-level protection for posted rows** (application
  checks only).
- **Balance cache writers**: `updateAccountBalanceOnTransaction` (incremental,
  float, unserialized), `recalculateAccountBalance` (excludes mirrors),
  `recalculateAccountBalanceFromPostedGl` (includes mirrors — disagrees).

## Read paths and their (inconsistent) dedup rules

| Surface | Source | Mirror JE rule | Other rules |
| --- | --- | --- | --- |
| Trial Balance (`lib/trialBalanceReport.js`) | Both ledgers | Excluded (`transactionId: null`) | Status exact `'posted'`/`'Posted'`; merge-survivor rollup; JS float math; no header-account skip |
| GL screen (`app/api/general-ledger/route.js`) | Both ledgers | Excluded | Also excludes GR Transactions when a GoodsReceipt JE points at them → **GR pairs vanish from both sides**; running balance accumulated after date-desc sort |
| GL export (`app/api/general-ledger/export/route.js`) | Both ledgers | **Not excluded** → double-count vs screen | No merge rollup |
| Journal list (`app/api/journal-entries/route.js`, all-sources) | Both | **Keeps mirror JE, drops Transaction** — opposite of GL | |
| Official ledger engine (`lib/officialLedgerEngine.js` → `fetchOfficialLedgerRows`) | Both | Excluded | Skips merged-away and group-header accounts — the closest existing canonical definition |
| P&L / BS (`lib/accountingReportService.js`) | Official ledger engine | Excluded | GL-pure |
| CoA balances (`app/api/chart-of-accounts/route.js`) | Bulk GL aggregates | Excluded | Falls back to AR invoices, inventory valuation, then **stored `Account.balance`** when no posted activity |
| Legacy BS (`lib/balanceSheetService.js`) | `AccountBalance` cache + stored balances | — | Still reachable via exports/ratios |

## Balance calculations

- Opening balance (GL screen, single account): sums both ledgers' lines before
  the start date, then signs by normal balance. Correct concept, float math.
- Running balance: per-line accumulation after sorting — **descending by
  default**, so not chronological.
- Normal balance: `Account.normalBalance` fallback to type heuristic
  (`Asset|Expense` → debit). CoA V2 `coaV2NormalBalance` not yet consumed by
  ledger code.
- All app-side aggregation is `parseFloat`/`Number` chains (audit engine uses
  integer cents; app does not).

## Status filtering / reversal filtering / period filtering

- Statuses observed: Transaction `posted` (writers), `Posted`/`POSTED`
  (tolerated in some readers), `void`; JournalEntry `Draft`, `Posted`, `Void`,
  plus V2 persisted set (`PendingApproval`, `Reversed`, `Cancelled`, …).
  Exact-case filters in TB vs both-case filters in GL → drift risk.
- Reversals: included as posted opposite entries (correct); some dashboards
  filter `isReversal=false` inconsistently. `ReversalAudit` trigger exists but
  table is unmapped.
- Period filtering is date-range based (`Transaction.date` vs
  `JournalEntry.entryDate` — different semantics); `accountingPeriodId` only
  populated on V2 journals.

## Caches

`Account.balance` (drift-proven), `AccountBalance` (code-keyed), CoA display
fallback chain. None are rebuild-versioned, reconciled, or invalidation-safe.

## Exports

TB export reuses the screen query (safe). GL export and journal export have
separate, divergent query logic (defects P5-I01, journal export search
clobbers its OR filter). PDF/Excel formatting is presentation-only.

## Defect list feeding Phase 5

1. No single canonical definition of "authoritative posted journal line"
   (five surfaces, four different rules).
2. GL export double-count (P5-I01); GR pair exclusion (P5-I02); journal-list
   inverse authority (P5-I03).
3. Non-chronological running balances (P5-I04).
4. No DB protection for posted journals (P5-I05).
5. Float arithmetic in every app-side balance computation.
6. Stored-balance fallbacks in CoA/legacy BS surfaces.
7. No reversal linkage on `JournalEntry`.
8. Legacy header-amount JE rows outside line aggregation (JRN-009).
9. Status-casing and date-null silent drops.
10. Parent/header handling inconsistent (TB includes headers).

## Migration risks

- Any change to the shared `JournalEntry` table must stay additive (legacy +
  V2 rows coexist).
- The DB immutability trigger must not break legitimate legacy flows
  (account-merge remapping updates lines on **legacy** journals; drafts are
  editable/deletable) — scope the trigger to Posted rows and financial columns,
  V2-scoped where legacy behaviour must survive.
- Reconciliation must expect QA-scale data locally but production-scale in
  deployment; all comparisons are batched.
