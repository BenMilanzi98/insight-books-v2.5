# Implementation Tasks — Accounting & Expenses

**Date:** 2026-07-25  
**Plan order:** see [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)  
**Gap IDs:** see [FINAL_GAP_REGISTER.md](./FINAL_GAP_REGISTER.md)

## Phase 1 — Retire anti-blueprint templates (P0)

| Task ID | Action | Paths | Tags | Gap |
|---------|--------|-------|------|-----|
| T1.1 | Mark `EXPENSE_ACCOUNTS_TEMPLATE` deprecated; stop creating accounts from it | `lib/expenseCategoriesTemplate.js` | `DUPLICATED`, `REFACTOR` | GAP-001 |
| T1.2 | Redirect `ensureExpenseAccountsForTenant` to blueprint ensure / CoA V2 template apply | Callers: `lib/budgetService.js`, `lib/incomeStatementService.js`, categories API | `REFACTOR` | GAP-001 |
| T1.3 | Stop using `lib/accountTemplates.js` codes that collide with blueprint (`5100` = Rent / Direct Labor / Admin) | `lib/accountTemplates.js` | `DUPLICATED`, `INCORRECT_POSTING` | GAP-002 |
| T1.4 | Align `lib/expenseCategoryNormalization.js` sync codes to blueprint leaves (not anti-blueprint 51xx under “Operating Expenses”) | `lib/expenseCategoryNormalization.js`, `lib/incomeStatementOperatingExpenseRollup.js` | `REFACTOR` | GAP-003 |
| T1.5 | Add CI/unit assertion: blueprint `5100` name is Cost of Sales; template must not create `5100` as Operating Expenses | `test/` + blueprint import | `COMPLETE_AND_VERIFIED` target | GAP-001 |

## Phase 2 — Expand blueprint expense leaves (P1)

| Task ID | Action | Paths | Tags | Gap |
|---------|--------|-------|------|-----|
| T2.1 | Add missing leaves to `lib/chartOfAccountsBlueprint.js`: overtime, fuel, licences, FX loss, inventory adj `5290`, corporate tax, project costs | `lib/chartOfAccountsBlueprint.js` | `MISSING_ACCOUNT`, `EXTEND` | GAP-004 |
| T2.2 | Update CoA V2 classification / template apply for new codes | `lib/coaV2/templates/`, `lib/coaV2/domain/codeGovernance.js` | `EXTEND` | GAP-004 |
| T2.3 | Document hierarchy in `EXPENSE_ACCOUNT_HIERARCHY.md` (keep in sync) | this pack | `EXTEND` | GAP-004 |

## Phase 3 — Fix purpose legacyCodes (P0)

| Task ID | Action | Paths | Tags | Gap |
|---------|--------|-------|------|-----|
| T3.1 | `VAT_INPUT.legacyCode`: `1150` → `1240` (blueprint VAT Recoverable) | `lib/coaV2/domain/systemPurposes.js` | `INCORRECT_POSTING` | GAP-005 |
| T3.2 | `PRIMARY_BANK.legacyCode`: do not resolve posting to header `1130`; map to first postable child policy or explicit leaf | `systemPurposes.js` + mapping registry | `INCORRECT_POSTING` | GAP-006 |
| T3.3 | `COST_OF_SALES`: purpose must not post to header `5100`; resolve to leaf (e.g. `5110`) or enforce posting-leaf validation | `systemPurposes.js`, adapters, `lib/coaV2/application/expenseAccountQuery.js` | `INCORRECT_POSTING` | GAP-007 |
| T3.4 | Backfill / remap tenants with wrong purpose mappings | scripts under `scripts/` + CoA V2 mappings API | `REFACTOR` | GAP-005–007 |

## Phase 4 — Fix expense payment adapter (P0)

| Task ID | Action | Paths | Tags | Gap |
|---------|--------|-------|------|-----|
| T4.1 | Replace non-AP debit of expense account on payment with AP / clearing / cash-only settlement | `app/api/expenses/partial-payment/route.js` | `DUPLICATE_POSTING_RISK`, `INCORRECT_POSTING` | GAP-008 |
| T4.2 | Introduce dedicated `postExpensePaymentAccounting` (or reuse supplier payment pattern) instead of overloaded `postTaxSettlementAccounting` for cash expenses | `lib/accountingV2/adapters/` | `REFACTOR` | GAP-008 |
| T4.3 | Idempotency key: `(tenantId, ExpensePayment, paymentId, EXPENSE_PAYMENT)` unique in `AcctV2EventRegistry` | event registry + adapter | `EXTEND` | GAP-008 |
| T4.4 | Regression test: approve+post expense then partial-pay must not second-debit expense P&L | `test/accountingV2/` | `COMPLETE_AND_VERIFIED` target | GAP-008 |

## Phase 5 — Expense state machine + posting preview (P1)

| Task ID | Action | Paths | Tags | Gap |
|---------|--------|-------|------|-----|
| T5.1 | Enumerate `Expense.status` and `paymentStatus` (replace free-form strings) | `prisma/schema.prisma`, `app/api/expenses/` | `EXTEND` | GAP-009 |
| T5.2 | Wire `previewPosting` for expense draft before approve | `lib/accountingV2/engine/postingEngine.js` + expense UI/API | `EXTEND` | GAP-010 |
| T5.3 | Document transitions in `EXPENSE_STATE_MACHINE.md` | this pack | `EXTEND` | GAP-009 |

## Phase 6 — Multi-line expenses (P2)

| Task ID | Action | Paths | Tags | Gap |
|---------|--------|-------|------|-----|
| T6.1 | Add `ExpenseLine` model (account, amount, tax, description) | `prisma/schema.prisma` | `EXTEND` | GAP-011 |
| T6.2 | Extend `postExpenseAccounting` to emit one debit line per `ExpenseLine` | `lib/accountingV2/adapters/expenseAdapter.js` | `EXTEND` | GAP-011 |
| T6.3 | UI: multi-line editor; keep single-line compatibility | expense pages | `EXTEND` | GAP-011 |

## Phase 7 — xlsx export/import dry-run (P2)

| Task ID | Action | Paths | Tags | Gap |
|---------|--------|-------|------|-----|
| T7.1 | Add xlsx backup export (parity with historical-transactions patterns) | expense export routes | `EXTEND` | GAP-012 |
| T7.2 | Import dry-run preview (no post) + confirm commit | import API | `EXTEND` | GAP-012 |
| T7.3 | Keep CSV path as `REUSE` until xlsx verified | existing CSV export | `REUSE` | GAP-012 |

## Phase 8 — Tests (continuous; gate each phase)

| Task ID | Action | Tags | Gap |
|---------|--------|-------|------|
| T8.1 | Blueprint vs anti-template collision tests | `COMPLETE_AND_VERIFIED` target | GAP-013 |
| T8.2 | Purpose legacyCode resolution tests | `COMPLETE_AND_VERIFIED` target | GAP-013 |
| T8.3 | Expense recognition + payment idempotency matrix | `COMPLETE_AND_VERIFIED` target | GAP-013 |
| T8.4 | Merge: V2 lifecycle no JE rewrite vs legacy merge rewrite (assert single policy) | `DUPLICATED` resolution | GAP-014 |

## Definition of done (pack)

- [ ] All P0 gaps closed or explicitly accepted with compensating control  
- [ ] Anti-blueprint template no longer creates conflicting `5100`  
- [ ] Expense payment cannot double-debit expense  
- [ ] Purpose codes match blueprint leaves/headers correctly  
- [ ] Tests green in CI for T8.1–T8.3
