# Current Posting Architecture — Pre-Phase-4 Inventory

Every code path that creates journals, creates journal lines, updates account
balances or marks sources as posted, as found in the repository before the Phase 4
engine was implemented. This analysis was completed before any posting function was
modified.

## 1. Journal stores

Two parallel journal stores exist (Phase 1 finding P1-03):

| Store | Header | Lines | Notes |
|---|---|---|---|
| Operational GL | `Transaction` | `TransactionLine` | Written by `postGlEntry`; most operational modules post here. `TransactionLine` carries `debitAmount`/`creditAmount` `Decimal(18,2)`. |
| Journal entries | `JournalEntry` | `JournalEntryLine` | Written by `lib/journalService.js` (manual journals) and a few modules. Header carries legacy `debit`/`credit` **Float** columns (unused by lines), nullable `tenantId`, globally-unique `referenceNumber`. Lines carry `Decimal(18,2)`. |

Stored balances live on `Account.balance` and are mutated directly
(`lib/accountBalanceService.js: updateAccountBalanceOnTransaction`), with
`AccountBalanceHistory` float snapshots.

## 2. Posting services

### 2.1 `lib/accountingEngine/postGlEntry.js` (legacy "centralized" engine)
- Creates `Transaction` + `TransactionLine` inside an optional caller transaction.
- Validation: ≥2 lines, one side per line, float-rounded balance
  (`roundMoney`), `assertAccountsAllowDirectPosting`, `assertPeriodOpen`,
  `assertNoDuplicatePostedSource` (query-based duplicate check — race-prone).
- Reference numbers from `journalService.generateReferenceNumber` (row count + ms).
- Updates `Account.balance` per line unless `skipBalanceUpdate`.
- Callers (18 sites): `app/api/accounts/opening-balances`, `app/api/capital-account(/contributions)`,
  `app/api/salary-advances`, `app/api/payments`, `app/api/liabilities`,
  `app/api/expenses/partial-payment`, `app/api/payroll/enhanced`, `app/api/purchases/bills`,
  `lib/openingBalanceService.js`, `lib/cogsIntegration.js`, `lib/paymentGlPosting.js`,
  `lib/taxCalculationService.js`, `lib/supplierBillExpenseFinalize.js`,
  `lib/transactionJournalHelpers.js`, `lib/inventoryWriteOffJournal.js`,
  `lib/accountingEngine/postGlEntryBatch.js`, `lib/accountingEngine/reverseGlEntry.js`,
  and the V2 legacy adapter.

### 2.2 `lib/journalService.js` (manual journals)
- `createDraftEntry` → `JournalEntry` status `Draft` + lines.
- `postEntry` → status `Posted`, `FLOAT_TOLERANCE` balance check, period lock check
  that **silently allows** posting when periods are unconfigured, direct balance updates.
- `voidEntry` / `createReversalEntry` — reversal creates an offsetting posted entry.
- API callers: `app/api/journal-entries/route.js`, `app/api/journal-entries/[id]/route.js`.

### 2.3 Module-local posting (bypasses both services)
- `lib/purchaseAccounting.js` — creates `JournalEntry`/`Transaction` rows and updates balances directly.
- `lib/transactionReversalService.js` — reversal transactions + balance updates.
- `app/api/liabilities/[id]/payments/route.js` — direct `journalEntry.create`.
- Various routes update `Account.balance` via `balance: { increment: … }`:
  `app/api/purchases/payments`, `app/api/purchases/bills`, `app/api/salary-advances`,
  `app/api/payroll/enhanced`, `app/api/invoices/refund`, `app/api/invoices/[id]/delete`,
  `app/api/chart-of-accounts/merge`.

### 2.4 Posting triggers observed
- During creation (sales, expenses, purchases), during approval (payroll), during
  payment (payments routes), during import (opening balances), during reversal,
  during reconciliation adjustments. No webhook-initiated posting exists today
  (mobile-money callbacks update payment status; posting happens in-route).

## 3. Existing controls (Phase 2/3, already live)

| Concern | Implementation |
|---|---|
| Event identity / idempotency | `AcctV2EventRegistry` (+ unique constraints), `deriveIdempotencyKey`, `hashCommandContent` |
| Posting attempts | `AcctV2PostingAttempt` |
| Transaction boundary | `runInAccountingTransaction` (transient-only retry) |
| Posting modes / flags | `AcctV2Configuration` + `AcctV2FeatureFlag`, `resolvePostingMode` |
| Shadow accounting | `AcctV2ShadowJournal(-Line)`, `AcctV2ShadowComparison`, `persistShadowJournal`, `compareProposalWithLegacy` |
| Outbox | `AcctV2Outbox`, `enqueueOutboxMessage` |
| Money | `lib/accountingV2/domain/money.js` (integer minor units) |
| Journal draft | `createJournalDraft` (balanced, structural rules) |
| Account mapping | `lib/coaV2/application/accountMappingRegistry.js` (`resolvePurposeAccount`) |
| Account validation primitives | `lib/coaV2/domain/behaviours.js` (`accountAcceptsNewPostings`, behaviour matrix) |
| Audit | `recordAccountingAudit` → append-only `AuditLog` |
| Errors | `AccountingV2Error` hierarchy |
| Observability | `logAccountingOperation` structured logs |
| Transition coordinator | `lib/accountingV2/application/accountingPostingService.js` — registers events, shadow-posts, delegates LEGACY; **refuses NEW_ENGINE** (implemented by this phase) |

## 4. Journal numbering today
- `generateReferenceNumber` (journalService): `TXN-{year}-{seq}-{ms}` — derives the
  sequence by scanning existing `Transaction.reference` values; collision-avoidance by
  millisecond suffix. Not concurrency-safe, not gap-free, mixes stores.

## 5. Period resolution today
- `lib/accountingPeriodService.js`: `getCurrentPeriod`, `checkPeriodLock`,
  `assertPeriodOpen` — string-status (`'closed'`) matching, silent-allow when the
  `accountingPeriod` table is missing/unconfigured.

## 6. Source posting state today
- No standard fields. Sources rely on generic statuses (`PAID`, `APPROVED`,
  `posted` booleans on some tables) and on `Transaction.sourceType/sourceId` links.
- The V2 registry (`AcctV2EventRegistry.status` + `journalEntryId` /
  `legacyTransactionId`) is the only standardized source→journal link.

## 7. Gaps the Phase 4 engine must close

1. `NEW_ENGINE` mode has no implementation (coordinator refuses it).
2. No posting-template framework; every module hand-rolls debit/credit lines.
3. No per-line account validation against Phase 3 classifications in any posting path.
4. No concurrency-safe journal numbering.
5. No journal immutability enforcement for posted entries.
6. No approval validation in any posting path.
7. No legacy↔new posting guard (both stacks could post the same event).
8. Balance updates are direct writes; V2 must not perpetuate this.
9. Period errors silently swallowed.
10. No engine APIs, preview, retry, or diagnostics.

These gaps define the Phase 4 workstreams in `PHASE_4_TASKS.md`.
