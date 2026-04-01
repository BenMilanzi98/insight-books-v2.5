# RBAC Audit (Phase 1)

This document captures the initial RBAC audit of the codebase and highlights where authorization is **missing or inconsistent**. It is used to drive the incremental rollout (audit/log-first → enforce).

## Summary (API routes)

Heuristic scan of `app/api/**/route.js` (499 files):

- **Permission-checked (`requirePermission`)**: 7
- **Auth-only (session user, tenant-scoped, but no permission check)**: 371
- **Public-by-implementation (no obvious session/auth usage)**: 121

> Notes
> - The “public” classification is heuristic. Some of these routes may be protected by non-standard mechanisms (e.g. `admin_token`) and require manual confirmation.
> - The high-level conclusion still stands: **permission checks are currently the exception**, not the rule.

## Routes that currently enforce permissions

These are the only routes that clearly call `requirePermission(...)` today:

- `app/api/employees/bulk-delete/route.js`
- `app/api/employees/[id]/route.js`
- `app/api/general-ledger/export/route.js`
- `app/api/leave/route.js`
- `app/api/leave/[id]/route.js`
- `app/api/leave/[id]/approve/route.js`
- `app/api/leave/[id]/reject/route.js`

## Highest-risk auth-only gaps (must enforce first)

These endpoints are tenant-scoped (so cross-tenant leakage is reduced) but they allow **privilege escalation within a tenant** if permissions are not enforced.

- **Users management** (should require `users.*`)
  - `app/api/users/route.js` (list + create)
  - `app/api/users/update/route.js`
  - `app/api/users/delete/route.js`
  - `app/api/users/deactivate/route.js`
  - `app/api/users/reactivate/route.js`
  - `app/api/users/reset-password/route.js`
  - `app/api/users/export/route.js`
  - `app/api/users/send-email/route.js`
- **Roles management** (should require `roles.*`)
  - `app/api/roles/route.js` (list + create)
  - `app/api/roles/update/route.js`
  - `app/api/roles/delete/route.js`
  - `app/api/roles/assign-users/route.js`
  - `app/api/roles/export/route.js`
- **Business / branch switching and setup**
  - `app/api/tenant/list/route.js`
  - `app/api/tenant/switch/route.js`
  - `app/api/branches/switch/route.js`
  - `app/api/branches/route.js`, `app/api/branches/[id]/route.js`
- **Inventory / stock mutations** (should require `inventory.*`)
  - `app/api/stock/*` (create/update/delete/restore/export/batch-delete/etc.)
  - `app/api/products/bulk-taxes/route.js` (should require `tax.update` or `inventory.update`)
- **Sales / POS mutations** (should require `sales.*`)
  - `app/api/sales/*` (void/refund/export/clear-history/etc.)
- **Accounting mutations** (should require `accounts.*`, `journalEntries.*`, `generalLedger.*`)
  - `app/api/journal-entries/*`
  - `app/api/chart-of-accounts/*`
  - `app/api/accounts/*`

## Public-by-implementation routes to review/lock down

The following categories contain many routes that did not show obvious session/user checks in the heuristic scan:

- **`app/api/admin/**`**: many routes appear “public” by the heuristic because they likely use `admin_token` flows rather than `getUserFromSession`. These must be reviewed and brought under the same deny-by-default pattern for admin authz.
- **Test/debug endpoints**: must be blocked in production or require explicit permissions.
  - Examples seen in repo: `app/api/test-simple/route.js` and other `app/api/test-*` endpoints

Separately identified sensitive debug endpoints that must be disabled/protected:

- `app/api/debug-env/route.js`
- `app/api/debug-jwt/route.js`

## UI authorization gaps (high signal)

- `components/PermissionGuard.js` currently **fails open** on errors (network/auth hiccups can expose protected UI).
- Sidebar (`components/Sidebar/Sidebar.js`) contains some **unconditional navigation items** (e.g., an always-visible Accounting section), which violates deny-by-default.
- Two divergent navigation configs exist (`components/Sidebar/Sidebar.js` vs `components/Sidebar/navigationConfig.js`).

### Page-level guarding coverage (tenant app)

Heuristic scan of `app/**/page.js` outside auth/admin areas:

- **Tenant pages**: 91
- **Tenant pages missing `PermissionGuard` reference**: 56

This means many pages likely rely on ad-hoc checks (or none) and must be standardized to deny-by-default (page guard + server enforcement).

## Next enforcement wave

1) Enforce RBAC (API) on users/roles + tenant/branch switching.
2) Fix UI fail-open, then ensure navigation/actions are hidden consistently.
3) Roll module-by-module (inventory → sales → accounting → reports → settings).
