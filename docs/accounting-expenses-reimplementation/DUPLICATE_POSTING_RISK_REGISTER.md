# Duplicate Posting Risk Register

**Date:** 2026-07-25  
**Tag family:** `DUPLICATE_POSTING_RISK`

| ID | Risk | Path | Mechanism | Severity | Status |
|----|------|------|-----------|----------|--------|
| DPR-001 | Expense payment re-debits P&L after recognition | `app/api/expenses/partial-payment/route.js` → `postTaxSettlementAccounting` with debit = `expenseAccountId` when no supplier | Different sourceType (`ExpensePayment` vs `Expense`) bypasses recognition idempotency | **P0** | OPEN |
| DPR-002 | Retry of partial-payment without registry uniqueness | Same route if adapter key weak / manual replay | Double cash credit + double expense/AP debit | **P0** | OPEN (verify unique on `ExpensePayment`+id) |
| DPR-003 | Legacy helper accidentally re-enabled | Any caller of `createExpenseJournalEntry` | Should throw `LEGACY_POSTING_REMOVED` | Mitigated | Monitor |
| DPR-004 | Shadow + NEW_ENGINE both writing | Cutover misconfig | Dual ledgers | **P1** | Guard via feature flags |
| DPR-005 | Tax posted on expense adapter **and** separate tax settlement | `postExpenseAccounting` taxAmount + extra tax route | Double VAT | **P1** | OPEN (audit call sites) |
| DPR-006 | COGS + expense both post inventory consumption | COGS adapter + misclassified expense | Double cost | **P1** | OPEN |
| DPR-007 | Merge rewrite + re-post repair | Merge moves lines; repair posts again | Inflated activity on target | **P1** | OPEN |
| DPR-008 | Categories ensure creates duplicate codes then both used | Anti-blueprint + blueprint both present | Ambiguous postings / OR lookups | **P1** | OPEN |

## Controls already in place

- `AcctV2EventRegistry` unique keys for adapter `executePosting` submissions — `COMPLETE_AND_VERIFIED` pattern.  
- Legacy writers fail-closed — `LEGACY_POSTING_REMOVED`.  
- Expense recognition idempotent on `Expense` + `EXPENSE_POSTED`.

## Required controls (not yet)

1. Payment must never debit expense if recognition already posted opex (post AP/clearing/cash only).  
2. Explicit `postExpensePaymentAccounting` with its own event type and tests.  
3. Integration test matrix: approve → pay → pay retry → reverse.

## Linkage

- GAP-008, GAP-013  
- [ACCOUNTING_POSTING_AUDIT.md](./ACCOUNTING_POSTING_AUDIT.md)  
- [POSTING_IDEMPOTENCY.md](./POSTING_IDEMPOTENCY.md)
