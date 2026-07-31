# Multi-Tenant and Security Audit

Method: code sweep of all accounting routes/services + data checks (TEN rules in the audit
engine). Data results on current DB: 0 cross-tenant transaction lines, 0 cross-tenant journal
lines, 0 NULL-tenant posted journals. The findings below are code-level and independently
verified where marked.

## Critical findings

### SEC-1 — `postGlEntry` does not verify account tenancy (verified)
`assertAccountsAllowDirectPosting` (`lib/coaDirectPostingEligibility.js:113-133`) loads accounts
by `id: { in: ids }` **without a `tenantId` filter**, and `postGlEntry` performs no other
ownership check on line accounts. Callers that validate account ownership (e.g. journal-entry
create, expense account resolution) are safe; any caller passing an attacker-influenced account
id can post lines into **another tenant's account**. The engine's error message claims tenant
scoping that the query does not implement.
**Rule TEN-001/TEN-003 — Critical.** Phase 2: add `tenantId` to the eligibility query and an
engine-level assertion that every line account belongs to `params.tenantId`.

### SEC-2 — Supplier financial routes accept `tenantId` from the query string (verified)
`app/api/suppliers/[id]/summary/route.js:16-27` reads `tenantId` from `searchParams` and calls
`getSupplierFinancialSummary(id, tenantId)` **without session authentication or authorization**
in the handler. Same pattern reported on `suppliers/reports/aging`, `top-spending`,
`suppliers/[id]`. Any authenticated (or unauthenticated, if middleware doesn't cover the route)
caller can read another business's supplier financials by guessing/enumerating tenant ids.
**TEN-003 — Critical IDOR.**

### SEC-3 — Reversal endpoint lacks RBAC
`app/api/transactions/reverse` requires only a valid session — any logged-in user of the tenant
can reverse journals; no finance-role or permission gate. **High.**

### SEC-4 — Capital account routes: permission check imported but unused
`requireStandardAccess` imported and not applied; session-only access to capital views/postings.
**High.**

## Sound patterns (verified)

- Core accounting routes derive `tenantId` from `getUserFromSession` — accounting periods,
  journal entries, capital account, transactions/reverse, dashboards, reports
  (`resolveReportTenantScope`, `bootstrapReportRoute`).
- Journal-entry creation validates line accounts with `{ tenantId: user.tenantId, id: { in } }`.
- Expense posting resolves accounts via tenant-scoped `resolveExpenseAccountSelection`.
- Period close/reopen gated by `canManageAccountingPeriods` (Owner/Admin/Finance).
- Journal creation gated by `canCreateJournalEntries`.
- Line-table queries generally scope through the parent (`transaction: { tenantId }`).

## Structural risks (schema)

- `JournalEntry.tenantId` and `Account.tenantId` are **nullable** (W4) — a NULL-tenant financial
  row escapes all tenant-scoped reads; TEN-002 monitors data continuously.
- `Tenant` cascade deletes reach journals and accounts (W5) — a tenant delete destroys ledgers.
- No DB-level guard against cross-tenant FK references (application-only); TEN-001 monitors.

## Permission matrix for accounting actions (as implemented)

| Action | Gate | Assessment |
|---|---|---|
| View accounting/reports | session + page/API guards | adequate |
| Create journals | `canCreateJournalEntries` | adequate |
| Post journals | same route family | adequate |
| Reverse journals | session only | **missing RBAC (SEC-3)** |
| Edit CoA | CoA access helpers (`chartOfAccountsAccess`) | adequate |
| Close/reopen periods | `canManageAccountingPeriods` | adequate |
| View capital | session only (`requireStandardAccess` unused) | **weak (SEC-4)** |
| View receivables/payables dashboards | session-scoped tenant | adequate |
| Supplier financial reports | **query-string tenantId, no auth in handler** | **broken (SEC-2)** |
| Exports | report scope helpers | adequate |

## Background/import scope

No queue framework; cron-style routes gated by `CRON_SECRET`. Import/backfill scripts
(`scripts/sync-existing-data-to-accounts.js`, `backfill-legacy-gl.cjs`) run with full DB access
and per-tenant loops — operator discipline required; recommend Phase 2 dry-run-default flags.
