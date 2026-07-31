# Final Gap Register

**Date:** 2026-07-25  
**Status values:** OPEN | IN_PROGRESS | REMEDIATED | DONE | ACCEPTED  
**All gaps below:** OPEN unless noted.

| Gap ID | Title | Severity | Status | Tags | Primary paths |
|--------|-------|----------|--------|------|---------------|
| GAP-001 | Anti-blueprint `expenseCategoriesTemplate` seeds `5100` as Operating Expenses | P0 | REMEDIATED | `DUPLICATED` | `lib/expenseCategoriesTemplate.js` (retired; no-op ensure; blueprint-only) |
| GAP-002 | `accountTemplates.js` reuses `5100` for unrelated leaves | P0 | OPEN | `DUPLICATED` | `lib/accountTemplates.js` |
| GAP-003 | `expenseCategoryNormalization` / opex rollup aligned to wrong codes | P0 | OPEN | `DUPLICATED`, `REFACTOR` | `lib/expenseCategoryNormalization.js`, `lib/incomeStatementOperatingExpenseRollup.js` |
| GAP-004 | Missing blueprint expense leaves (overtime, fuel, licences, FX loss, `5290`, corporate tax, project costs) | P1 | REMEDIATED | `MISSING_ACCOUNT`, `EXTEND` | `lib/chartOfAccountsBlueprint.js` (`5205`, `5341`, `5342`, `5520`, `5290`, `5580`, `5160`, …) |
| GAP-005 | `VAT_INPUT.legacyCode` is `1150` vs blueprint `1240` | P0 | REMEDIATED | `INCORRECT_POSTING` | `lib/coaV2/domain/systemPurposes.js` (`1240`) |
| GAP-006 | `PRIMARY_BANK.legacyCode` is header `1130` | P0 | REMEDIATED | `INCORRECT_POSTING` | `lib/coaV2/domain/systemPurposes.js` (`1131` leaf policy) |
| GAP-007 | `COST_OF_SALES.legacyCode` is header `5100` | P0 | REMEDIATED | `INCORRECT_POSTING` | `lib/coaV2/domain/systemPurposes.js` (`5110`) |
| GAP-008 | Expense partial-payment can double-debit expense via `postTaxSettlementAccounting` | P0 | REMEDIATED | `DUPLICATE_POSTING_RISK`, `INCORRECT_POSTING` | `app/api/expenses/partial-payment/route.js` → `postExpensePaymentAccounting` + `EXPENSE_PAYMENT_NO_ADDITIONAL_GL` |
| GAP-009 | Free-form expense `status` / `paymentStatus` — no state machine | P1 | REMEDIATED | `EXTEND` | `lib/expenses/expenseStateMachine.js` (DB string–aligned transitions) |
| GAP-010 | No expense posting preview UI/API wiring | P1 | REMEDIATED | `EXTEND` | `lib/expenses/expensePostingPreview.js`, `POST /api/expenses/preview-posting` |
| GAP-011 | No `ExpenseLine` — single-line only | P2 | OPEN | `EXTEND` | `prisma/schema.prisma` |
| GAP-012 | CSV export only; no xlsx backup / import dry-run | P2 | REMEDIATED | `EXTEND` | `lib/expenses/expenseExcelExport.js`, `expenseExcelImport.js`, `/api/expenses/export-xlsx`, `/api/expenses/import-xlsx` |
| GAP-013 | Missing automated tests for P0 CoA/payment invariants | P0 | IN_PROGRESS | tests | `test/expenses/`, `test/accountingV2/` |
| GAP-014 | CoA merge rewrite JE lines vs V2 lifecycle no-rewrite | P1 | OPEN | `DUPLICATED` | `app/api/chart-of-accounts/merge/route.js` vs coa-v2 lifecycle |
| GAP-015 | Dual `code` / `accountCode` identity risk | P0 | OPEN | `DUPLICATED` | `Account` model + lookups |
| GAP-016 | Residual `Account.balance` mutations (recalculate, capital, merge) | P1 | OPEN | `LEGACY_READ_ONLY` drift | `lib/accountBalanceService.js`, merge, capital |

## Severity guide

- **P0** — Incorrect books, wrong CoA seed, or tenant-critical isolation/idempotency hole. Block feature expansion.  
- **P1** — Material governance / UX / merge policy; fix in same programme after P0.  
- **P2** — Product completeness (multi-line, xlsx); schedule after P0/P1.

## Closure order (must match plan)

1. GAP-001, GAP-002, GAP-003, GAP-015 (templates + identity)  
2. GAP-004 (leaves)  
3. GAP-005, GAP-006, GAP-007 (purposes)  
4. GAP-008 (+ GAP-013 tests)  
5. GAP-009, GAP-010  
6. GAP-011  
7. GAP-012  
8. GAP-014, GAP-016 (parallel hardening)
