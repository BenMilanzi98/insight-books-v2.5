# Expense Module Audit

**Date:** 2026-07-25  
**Product verdict:** `EXTEND` — not full `REIMPLEMENT`. Recognition posting via `postExpenseAccounting` works.

## Data model (current)

`prisma/schema.prisma` → `model Expense`:

| Field | Notes |
|-------|-------|
| `amount`, `taxAmount`, `taxRate` | Single header totals (amount includes tax) |
| `category` (string) + `categoryId` | Dual category representation |
| `expenseAccountId` | CoA posting leaf FK |
| `status` | **Free-form string** — no enum |
| `paymentStatus` | String default `"Fully paid"` — free-form |
| `paidAmount`, `paymentReference`, `paymentMethod` | Payment tracking |
| `supplierId` | Switches AP vs cash credit path |
| `branchId`, `employeeId`, historical/reversal fields | Present |
| Attachments | `ExpenseAttachment` |
| Payments | `Payment[]` relation |

**Missing:** `ExpenseLine` model — **no multi-line expenses**. Tag: `EXTEND` (GAP-011).

## API / UI surface

| Capability | Path / behaviour | Tag |
|------------|------------------|-----|
| CRUD / list | `app/api/expenses/route.js` | `REUSE` / `EXTEND` |
| Partial payment | `app/api/expenses/partial-payment/route.js` | `INCORRECT_POSTING` |
| GL on approve | `postExpenseAccounting` via `lib/expenseGlPosting.js` | `REUSE` |
| Account selector | `/api/categories?type=expense` → CoA IDs | `EXTEND` (fix ensure source) |
| Posting preview UI | Absent | Missing (GAP-010) |
| State machine | Absent — free-form statuses | Missing (GAP-009) |
| Multi-line editor | Absent | Missing (GAP-011) |

## Status strings (observed patterns)

Not enforced in schema. Common values in code/UI include variants of Draft / Pending / Approved / Rejected and payment statuses such as `Pending`, `Partially paid`, `Fully paid`. Case and wording drift is possible.

**Tag:** `REFACTOR` → enumerated SM ([EXPENSE_STATE_MACHINE.md](./EXPENSE_STATE_MACHINE.md)).

## Posting behaviour (module view)

```
Draft ──approve──► postExpenseAccounting (idempotent EXPENSE_POSTED)
                         │
                         ▼
              Dr Expense / VAT   Cr Cash|AP

Later payment (non-supplier) ──► postTaxSettlementAccounting
                         │
                         ▼
              Dr Expense again   Cr Bank     ← BUG
```

## What to keep

- Header `Expense` entity and attachments  
- `expenseAccountId` CoA linkage  
- V2 recognition adapter  
- Supplier-linked AP credit path in recognition  

## What to change

1. Payment adapter (P0)  
2. Enumerated status + paymentStatus (P1)  
3. Preview before post (P1)  
4. `ExpenseLine` + adapter multi-debit (P2)  
5. Stop anti-blueprint ensure behind categories API (P0 template work)

## Classification summary

| Aspect | Tag |
|--------|-----|
| Module strategy | `EXTEND` |
| Recognition posting | `COMPLETE_AND_VERIFIED` (happy path) |
| Payment posting | `INCORRECT_POSTING` |
| Data model | `EXTEND` (lines) |
| UX completeness | `EXTEND` |
