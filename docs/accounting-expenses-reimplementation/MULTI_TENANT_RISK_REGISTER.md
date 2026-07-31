# Multi-Tenant Risk Register

**Date:** 2026-07-25

| ID | Risk | Path / pattern | Severity | Status | Tag |
|----|------|----------------|----------|--------|-----|
| MTR-001 | Ensure-template creates global-shaped codes per tenant incorrectly | `ensureExpenseAccountsForTenant(tenantId)` using anti-blueprint | P0 | OPEN | `DUPLICATED` |
| MTR-002 | Purpose backfill applies wrong `legacyCode` to every tenant | Stage-2 mapping from `systemPurposes.js` | P0 | OPEN | `INCORRECT_POSTING` |
| MTR-003 | Merge / lifecycle without `tenantId` predicate on related updates | Must verify every `updateMany` in merge includes tenant scope | P0 | OPEN (verify) | isolation |
| MTR-004 | Categories API returns another tenant’s accounts if guard weak | `/api/categories?type=expense` | P0 | Monitor | isolation |
| MTR-005 | Event registry uniqueness missing tenant dimension | Should be composite with `tenantId` | P0 | Verify `COMPLETE_AND_VERIFIED` | idempotency |
| MTR-006 | Shared blueprint mutation (file is code — OK) vs DB seed scripts without tenant filter | scripts under `scripts/` | P1 | OPEN | isolation |
| MTR-007 | Report rollups using template ensure inside request mutate tenant CoA as side effect | `incomeStatementService` ensure calls | P1 | OPEN | surprise mutation |
| MTR-008 | Cross-tenant accountId on expense if client supplies foreign UUID | `expenseAccountId` resolution | P0 | Must fail closed via `resolvePostableExpenseAccount(tenantId, …)` | isolation |

## Controls observed

- Expense payment resolves accounts with `user.tenantId`.  
- Adapters take `tenantId` in context (`contextFromSession`).  
- CoA V2 integrity audit flags mapping to account owned by another tenant (`lib/accountingAudit/coaIntegrityAudit.js`).

## Required hardening

1. Every expense account resolve: `account.tenantId === ctx.tenantId` or throw.  
2. Ban side-effect CoA creation inside read-only report GETs (or gate behind explicit migrate flag).  
3. Tenant-scoped unique indexes already on registry — confirm in Prisma model `AcctV2EventRegistry`.  
4. Multi-tenant test: two tenants same expense external ref cannot share journals.
