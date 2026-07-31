# Phase 2 Remediation Backlog (prioritized, evidence-based)

No item below is implemented in Phase 1. Priorities: P0 immediate integrity/security failure,
P1 major accounting inaccuracy, P2 important control weakness, P3 improvement.

## P0

### P0-1 — Consolidate to a single journal ledger
- **Problem**: `Transaction`/`TransactionLine` and `JournalEntry`/`JournalEntryLine` coexist; legacy header-amount `JournalEntry` rows are invisible to line-based reports but included in stored balances (R-01).
- **Evidence**: JRN-009 findings; proven 5,000 divergence trace (`GENERAL_LEDGER_AUDIT.md`).
- **Root cause**: incremental migrations left the old ledger live.
- **Solution**: designate `Transaction` as the sole ledger. Migrate every posted line-based `JournalEntry` (transactionId NULL) into `Transaction`; convert legacy header-amount pairs into balanced line entries with `sourceType='legacy_journal_migration'`, preserving originals read-only.
- **Migration**: additive migration journal per legacy entry; keep `JournalEntry` table frozen (no new writes) until decommission.
- **Rollback**: migration journals are reversible (each carries source linkage); original rows untouched.
- **Testing**: audit engine `ledger`+`journals` modules must report 0 GL-002/JRN-009 after migration; before/after trial balance identical per tenant.
- **Dependencies**: none. **Risk**: medium (data migration).

### P0-2 — Database-level duplicate-posting key
- **Problem**: duplicate check is TOCTOU-racy; no unique posting key (R-03).
- **Solution**: partial unique index `(tenantId, sourceType, sourceId) WHERE lower(status)='posted' AND NOT "isReversal"`; enforce `sourceId` = source-row PK convention; remove `skipDuplicateCheck` except for reversal internals.
- **Migration**: detect+resolve existing violators first (JRN-006 output is the worklist).
- **Testing**: concurrency test posting same source twice in parallel must yield exactly one row.
- **Dependencies**: P0-3 (sourceId normalization). **Risk**: low.

### P0-3 — Source→journal linkage backfill and enforcement
- **Problem**: `sourceId` free-form; `SupplierBill.journalEntryId`/`SupplierPayment.journalEntryId` left NULL; sales/payments traceable only by naming convention (R-09).
- **Evidence**: `QA-S02-SALE` posted under `sourceId='QA-pos-mobile-money'`; observed NULL FK links.
- **Solution**: enforce PK-based `sourceId` at `postGlEntry`; backfill existing rows by reference/description matching with manual review of ambiguous cases; write FK links on bills/payments.
- **Testing**: sources audit module must report 0 highly-likely missing-journal findings for posted documents.
- **Risk**: medium (matching quality) — requires finance-team confirmation for ambiguous rows.

### P0-4 — Stop trusting stored balances in any report path
- **Problem**: `Account.balance` drifts (R-02); CoA page shows stored balances.
- **Solution**: reporting reads journal aggregation only (helpers already exist: `recalculateAccountBalanceFromPostedGl` semantics); keep `Account.balance` as a cache rebuilt transactionally or drop it; fix the two rebuild functions to agree on mirror exclusion.
- **Testing**: GL-002 findings = 0 after nightly rebuild; concurrency posting test keeps balance = derived.

### P0-5 — Close tenant-isolation holes (security)
- **Problem**: `assertAccountsAllowDirectPosting` loads accounts without tenant filter (R-19); supplier financial routes accept query-string `tenantId` without auth (R-20); reversal/capital endpoints lack RBAC (R-21).
- **Evidence**: verified code cites in `MULTI_TENANT_AND_SECURITY_AUDIT.md`.
- **Solution**: tenant filter + ownership assertion inside `postGlEntry`; session-derived tenant + permission gates on supplier reports, `transactions/reverse`, capital routes.
- **Testing**: authz tests posting with foreign account ids must fail; supplier routes must 401/403 cross-tenant.
- **Risk**: low. **Priority: P0 — ship before any other Phase 2 item.**

### P0-6 — Eliminate engine-bypass posting paths
- **Problem**: 11 locations create journals or move balances outside `postGlEntry` (R-22..R-25): supplier payment dual T+J + unbalanced tax line, goods-receipt J-only vs bill T double-post, invoice Draft→issued wrong-table idempotency check, invoice refund/delete direct creates, asset acquisition without balance update or sourceId, liability payment J+empty-T+AB, expense partial-payment re-debit, POS cash deposits (AB only), payroll dual posting, manual-journal closed-only period check, `processCapitalTransfer`.
- **Solution**: route every path through `postGlEntry`/`reverseGlEntry`; delete `processCapitalTransfer`; journal-backed POS deposits; fix invoice idempotency to check `Transaction`; single payroll posting path; correct expense partial payment to Dr AP.
- **Testing**: posting matrix regression per event; audit engine JRN/GL modules clean.
- **Risk**: medium-high (touches many modules) — sequence after P0-1 ledger decision.

## P1

### P1-1 — AR/AP single-source posting + invariants
- **Problem**: subledger vs control account maintained independently; `remainingBalance` inconsistent (R-04).
- **Solution**: invoice/payment posting updates operational fields and GL in one transaction; DB check `remainingBalance = total − totalPaid`; nightly AR-001/AP-001 reconciliation using the audit engine.
- **Repair**: reconcile the observed 15,000-class gaps with finance sign-off (partial posting on `QA-S18-INV` pattern).

### P1-2 — Journal-backed liability lifecycle
- **Problem**: Liability module balances live outside GL; unsupported-liability symptom (R-05).
- **Solution**: liability create/payment posts GL (loan proceeds, principal, interest split); require `glAccountId`; migration journals for existing rows.

### P1-3 — Period control hardening
- **Problem**: fail-open coverage, boundary-day double coverage, no period FK (R-07).
- **Solution**: auto-generate monthly periods per financial year; normalize period boundaries to tenant-local date semantics; store `accountingPeriodId` on journals at posting; block operational edits of documents in closed periods uniformly.

### P1-4 — Year-end closing process
- **Problem**: retained earnings never updated (R-08).
- **Solution**: closing journal (revenue/expense → 3300 → 3200) per the Financial Calendar framework document; reopening reverses closing journal.

### P1-5 — Decimal migration for Float money fields
- **Problem**: 48 models with Float money (R-10), including `JournalEntry.debit/credit`, payroll, liabilities, equity.
- **Solution**: staged `Decimal(18,2)` migrations, highest-risk tables first (JournalEntry, Liability, SupplierPayment, EquityAccount, Payroll).

## P2

### P2-1 — Reversal integrity constraints: partial unique on active reversal per original; map `ReversalAudit`; unify reversal status across ledgers/operational rows (R-12, R-18).
### P2-2 — Status normalization: single-case posted/draft/cancelled enum with check constraint; fix exact-casing filters (R-13).
### P2-3 — NOT NULL tenant scope on `JournalEntry.tenantId`, `Account.tenantId`; restrict tenant cascade deletes of financial history (R-14, R-11).
### P2-4 — Central account-mapping registry replacing hardcoded code constants + "ensure" auto-creation; per-tenant mapping validation screen (R-16).
### P2-5 — Report lineage enforcement: migrate AR/AP aging + dashboards to GL sources (R-15); adopt `reportingSourceRules.js` as the single gate.
### P2-6 — Delete protection: forbid hard delete of posted journals and their sources; soft-delete with audit.

## P3

### P3-1 — Drop or re-key `AccountBalance` (name-keyed, Float, unused).
### P3-2 — Remove duplicate legacy columns on `Account` (`code/name/type`).
### P3-3 — Recommended indexes: `(tenantId, date, status)` on `Transaction`; covering index for `TransactionLine(accountId, transactionId)` — analyze lock impact before deploying.
### P3-4 — Internal read-only audit UI at `/system/accounting-audit` surfacing engine runs (deferred from Phase 1; CLI + artifacts cover the need).

## Safest implementation sequence

1. P0-2 constraints in shadow (detect-only) → 2. P0-3 linkage backfill → 3. P0-1 ledger
consolidation → 4. P0-4 stored-balance retirement → 5. P1-1/P1-2 subledger repairs with finance
sign-off → 6. P1-3/P1-4 period+closing → 7. P1-5 decimal migration → 8. P2 batch → 9. P3.
Every step preceded and followed by a full audit-engine run; diffs must be explainable.
