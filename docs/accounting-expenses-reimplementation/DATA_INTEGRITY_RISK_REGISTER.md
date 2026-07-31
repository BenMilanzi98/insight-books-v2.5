# Data Integrity Risk Register

**Date:** 2026-07-25

| ID | Risk | Evidence | Tag | Severity | Status |
|----|------|----------|-----|----------|--------|
| DIR-001 | Dual `code` / `accountCode` divergence | Lookups use OR of both (`lib/cogsIntegration.js`, etc.) | `DUPLICATED` | P0 | OPEN |
| DIR-002 | Anti-blueprint `5100` Operating Expenses vs blueprint Cost of Sales | `lib/expenseCategoriesTemplate.js` vs `lib/chartOfAccountsBlueprint.js` | `DUPLICATED` | P0 | OPEN |
| DIR-003 | Purpose `VAT_INPUT` → `1150` vs blueprint `1240` | `lib/coaV2/domain/systemPurposes.js` | `INCORRECT_POSTING` | P0 | OPEN |
| DIR-004 | Purpose `PRIMARY_BANK` → header `1130` | Blueprint: rollup-only | `INCORRECT_POSTING` | P0 | OPEN |
| DIR-005 | Purpose `COST_OF_SALES` → header `5100` | Group account | `INCORRECT_POSTING` | P0 | OPEN |
| DIR-006 | Merge rewrites `JournalEntryLine.accountId` | `app/api/chart-of-accounts/merge/route.js` | `DUPLICATED` vs V2 lifecycle | P1 | OPEN |
| DIR-007 | `Account.balance` treated as truth by residual callers | recalculate / capital / merge | `LEGACY_READ_ONLY` drift | P1 | OPEN |
| DIR-008 | `INVENTORY_ADJUSTMENT` purpose `5290` without blueprint leaf | `systemPurposes.js` vs blueprint array | `MISSING_ACCOUNT` | P1 | OPEN |
| DIR-009 | Free-form expense `status` / `paymentStatus` | `prisma/schema.prisma` `Expense` | integrity of workflow | P1 | OPEN |
| DIR-010 | Single-line amount with no line table | No `ExpenseLine` | allocation integrity | P2 | OPEN |
| DIR-011 | Income statement opex rollup mixes template + blueprint | `lib/incomeStatementOperatingExpenseRollup.js` | report integrity | P1 | OPEN |

## Financial SoT statement (Phase 4)

Posted `JournalEntryLine` (V2 journals) are financial SoT. Stored `Account.balance` is diagnostic/cache only when ignored by reporting (`lib/coaAccountBalanceBreakdown.js` labels legacy balance as ignored).

## Integrity gates to add

1. Audit query: active accounts where `code IS DISTINCT FROM accountCode`.  
2. Audit query: `accountCode='5100' AND accountName ILIKE '%operating%'`.  
3. Purpose mapping audit: `VAT_INPUT` must resolve to `1240` (or mapped postable equivalent).  
4. Forbid posting to accounts with subtype Group / header flags.  
5. Single merge policy: no in-place JE rewrite (or explicitly versioned transfer journal).
