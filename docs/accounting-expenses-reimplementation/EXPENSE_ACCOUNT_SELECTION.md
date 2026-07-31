# Design Stub — Expense Account Selection

**Date:** 2026-07-25  
**Current path:** CoA ID selector via `/api/categories?type=expense` (ensure historically called `ensureExpenseAccountsForTenant`)  
**Tag:** `EXTEND` / fix ensure source

## Rules

1. Selector lists **postable** expense accounts for `tenantId` only.  
2. Exclude headers/groups (`5000`, `5100`, `5700`).  
3. Exclude COGS band `5100–5199` by default (use `includeCostOfSales` only for inventory/COGS flows).  
4. Prefer `lib/coaV2/application/expenseAccountQuery.js` as the single query implementation.  
5. Do **not** create anti-blueprint accounts on GET. Seeding is an explicit admin/migrate action using blueprint apply.

## Display

Show `accountCode — accountName`. Store `expenseAccountId` (UUID), never free-text code alone on the expense row.

## Validation on save / approve

| Check | Failure |
|-------|---------|
| Account belongs to tenant | 400/403 |
| Account active & not merged | 400 |
| Account postable | 400 |
| Not COGS leaf unless allowed | 400 |
| Purpose-restricted accounts (e.g. salaries control) | permission gate |

## Mapping from category text

If UI still collects category labels, map via blueprint-aligned normalization only (after GAP-003 fix). Never invent `5100` Operating Expenses.

## Multi-line (Phase 6)

Each `ExpenseLine` has its own `expenseAccountId` under the same rules.
