# Test Coverage Audit

**Date:** 2026-07-25  
**Focus:** Proof gaps for CoA template collisions, purpose codes, expense recognition vs payment, idempotency.

## Existing coverage (indicative)

| Area | Location | Assessment |
|------|----------|------------|
| Accounting V2 unit/integration | `test/accountingV2/` | Partial — engine/reports present; expense payment matrix thin |
| Legacy report redirects | `test/accountingV2/legacyReportRedirectMap.test.js` | Present |
| CoA integrity rules | audit libs / CI accounting-verify workflow | Present at governance level |
| Expense module E2E | Sparse relative to P0 payment bug | **Gap** |

## Required tests (not optional for P0 close)

| Test ID | Assertion | Priority |
|---------|-----------|----------|
| TC-BP-01 | Blueprint `5100` name is Cost of Sales | P0 |
| TC-BP-02 | `EXPENSE_ACCOUNTS_TEMPLATE` must not be invoked to create accounts (or is no-op) | P0 |
| TC-PUR-01 | `VAT_INPUT` resolves to `1240` (or mapped equivalent ≠ 1150 unless alias) | P0 |
| TC-PUR-02 | `PRIMARY_BANK` resolution refuses bare header `1130` for posting | P0 |
| TC-PUR-03 | `COST_OF_SALES` posting uses leaf, not header `5100` | P0 |
| TC-EXP-01 | Approve expense → one `EXPENSE_POSTED` journal; retry no-ops | P0 |
| TC-EXP-02 | Non-supplier: pay after recognition does **not** increase expense account debit total | P0 |
| TC-EXP-03 | Supplier AP expense: pay debits AP only | P0 |
| TC-EXP-04 | Payment retry idempotent on `ExpensePayment` id | P0 |
| TC-MT-01 | Tenant A cannot post using Tenant B `expenseAccountId` | P0 |
| TC-MER-01 | Documented merge policy test (rewrite vs no-rewrite) — single winner | P1 |
| TC-UI-01 | Preview endpoint returns balanced lines without persisting | P1 |
| TC-IMP-01 | Import dry-run zero journal writes | P2 |

## Classification

| Suite | Tag |
|-------|-----|
| Engine executePosting happy paths | `REUSE` / extend |
| Expense payment double-debit | **Missing** — blocks `COMPLETE_AND_VERIFIED` |
| Blueprint collision | **Missing** |
| Purpose legacyCode | **Missing** or stale |

## CI

`.github/workflows/accounting-verify.yml` should gain the P0 tests above as a gate before expense/xlsx feature work.

**Gap link:** GAP-013.
