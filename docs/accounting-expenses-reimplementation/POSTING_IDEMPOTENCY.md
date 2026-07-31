# Design Stub — Posting Idempotency

**Date:** 2026-07-25  
**Implementation:** `lib/accountingV2/infrastructure/eventRegistryRepository.js` → `AcctV2EventRegistry`  
**Tag:** `COMPLETE_AND_VERIFIED` pattern; expense payment needs explicit keys

## Key shape

Unique per tenant on approximately:

`(tenantId, sourceModule, sourceType, sourceId, eventType)`

Register-before-post (or atomic with post) so retries return the existing journal outcome instead of inserting a second.

## Expense keys

| Business action | sourceType | sourceId | eventType | Notes |
|-----------------|------------|----------|-----------|-------|
| Recognition | `Expense` | `expense.id` | `EXPENSE_POSTED` | Exists today via adapter |
| Payment | `ExpensePayment` | `payment.id` | `EXPENSE_PAYMENT` (target) | Must not reuse tax-settlement ambiguity |
| Reversal of recognition | `Expense` | `expense.id` | `EXPENSE_REVERSED` / reverse link | Via reversal service |
| Reversal of payment | `ExpensePayment` | `payment.id` | payment reverse event | Pair with payment |

## Why DPR-001 still happens

Idempotency is per **source identity**, not per **economic effect**.  
`Expense` + `EXPENSE_POSTED` and `ExpensePayment` + settlement are different keys; both can debit the expense account if the payment adapter is wrong.

**Fix:** Correct lines (no second expense debit) **and** keep payment idempotent on `payment.id`.

## Retry semantics

| Scenario | Expected |
|----------|----------|
| Double approve click | Second call returns existing posted journal |
| Double pay click | Second call no-ops on same `payment.id` |
| Two payments (partial) | Two registry rows; two settlement journals; expense P&L unchanged after recognition |
| Network timeout after commit | Client retry safe |

## Test mandates

TC-EXP-01, TC-EXP-04 from [TEST_COVERAGE_AUDIT.md](./TEST_COVERAGE_AUDIT.md).
