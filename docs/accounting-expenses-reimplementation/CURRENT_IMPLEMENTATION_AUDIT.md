# Current Implementation Audit

**Date:** 2026-07-25  
**Method:** Forensic code path review of CoA, V2 posting, and expense module.

## Executive classification

| Area | Classification | Rationale |
|------|----------------|-----------|
| V2 posting engine (`executePosting`) | `COMPLETE_AND_VERIFIED` / `REUSE` | Sole authoritative writer; legacy `postGlEntry` fail-closed |
| Expense recognition (`postExpenseAccounting`) | `EXTEND` | Works for approved single-line expenses; missing preview, multi-line, SM |
| Expense payment (`partial-payment` → `postTaxSettlementAccounting`) | `INCORRECT_POSTING` / `DUPLICATE_POSTING_RISK` | Can debit expense again after recognition |
| CoA blueprint | `REUSE` / `EXTEND` | Canonical structure; missing some expense leaves |
| Anti-blueprint expense templates | `DUPLICATED` / retire | `5100` = Operating Expenses vs blueprint Cost of Sales |
| System purpose `legacyCode`s | `INCORRECT_POSTING` | VAT_INPUT, PRIMARY_BANK, COST_OF_SALES header bugs |
| CoA merge | `DUPLICATED` | V2 lifecycle no rewrite vs `app/api/chart-of-accounts/merge` rewrites `JournalEntryLine` |
| `Account.balance` | `LEGACY_READ_ONLY` (intent) with residual mutators | Recalculate / capital / merge still touch cache |
| Expense product UX | `EXTEND` | CoA ID selector present; no posting preview; CSV only |

## Architecture snapshot

```
Operational event (Expense, POS, Invoice, …)
        │
        ▼
Adapter (lib/accountingV2/adapters/*)
        │
        ▼
cutoverBridge → executePosting
        │
        ├─ AcctV2EventRegistry (idempotency)
        ├─ Journal + JournalEntryLine (financial SoT)
        └─ Account.balance  ✗ not SoT (Phase 4)
```

## What works today

1. **Fail-closed legacy posting** — Helpers in `lib/transactionJournalHelpers.js`, `lib/purchaseAccounting.js`, tax auto-post, etc. throw `LEGACY_POSTING_REMOVED` and point to V2 adapters.
2. **Expense approval posting** — `app/api/expenses/route.js` and `lib/expenseGlPosting.js` call `postExpenseAccounting` (`lib/accountingV2/adapters/expenseAdapter.js`).
3. **Idempotent recognition** — Event registry unique keys prevent double `EXPENSE_POSTED` for the same source.
4. **Adapters wired** for expense, POS, invoice, customer payment, supplier, payroll-related, asset, bank, opening balances (see posting matrix).
5. **Expense account picker** — Uses CoA IDs via `/api/categories?type=expense` (backed by account ensure paths).

## What is broken or incomplete

1. **Anti-blueprint templates** still seed wrong `5100` semantics (`lib/expenseCategoriesTemplate.js`).
2. **Purpose backfill** can map VAT input to `1150` while blueprint VAT Recoverable is `1240`.
3. **PRIMARY_BANK → 1130** is a rollup header (“Bare 1130 is rollup-only” in blueprint comments).
4. **COST_OF_SALES → 5100** is a group header; posting should hit leaves (`5110`…).
5. **Partial payment** for non-supplier expenses debits the expense account again (`app/api/expenses/partial-payment/route.js` lines ~128–161).
6. **No `ExpenseLine` model** — `prisma/schema.prisma` `Expense` is single amount/account.
7. **Free-form `status` / `paymentStatus` strings** — no enforced state machine.
8. **No posting preview UI** — engine has `previewPosting` but expenses do not surface it.
9. **Export** — CSV only; no xlsx backup / import dry-run.
10. **Merge policy split** — V2 account lifecycle avoids rewriting posted lines; legacy merge route updates `JournalEntryLine.accountId`.

## Dual column risk (CoA)

`Account` retains both `code` and `accountCode` in query paths (e.g. `lib/cogsIntegration.js` uses `OR: [{ code: '5100' }, { accountCode: '5100' }]`). Classification: `DUPLICATED` identity risk — resolution can hit different rows if columns diverge.

## Recommendation (product)

**Do not full-REIMPLEMENT the expense module.** Extend recognition posting, fix payment GL, retire anti-blueprint seeders, expand blueprint leaves, then add SM / preview / multi-line / xlsx in that order ([IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)).
