# Final Readiness Decision — System Admin Reimplementation

**Date:** 2026-07-27  
**Verdict:** **Phases 1–6 control-plane foundations are production-ready.** Full cosmetic redesign of every legacy admin form remains incremental. No invented metrics on hardened paths.

## Locked decisions completed

| Decision | Result |
|----------|--------|
| Phased delivery | Followed |
| CoA old route | Redirects to `/insightbooks/dashboard?notice=coa-removed` |
| System CoA APIs | Kept (`/api/admin/system-coa*`) |
| Tenant CoA | Untouched at `/chart-of-accounts` |

## Phase status

| Phase | Status | Evidence |
|-------|--------|----------|
| 1 Audit + CoA + Shell | **Done** | Docs pack, redirect, AdminShell/Sidebar, design tokens |
| 2 Tenants/Users/RBAC/Support/Settings | **Done** | Lifecycle, support access, PlatformGlobalSettings, permissions |
| 3 Platform billing | **Done** | PlatformInvoice/Payment + APIs + billing UI |
| 4 Affiliates/Android/Email | **Done** | Idempotent commissions/payouts, checksum API, templates/suppression |
| 5 MRA/Audit/Health | **Done** | Real health + email queues/retry; audit perms; security mocks retired |
| 6 Search/Reports/Hardening | **Done** | Search UI, reports page, dry-run imports, secure user export, residual suite |

## Critical / High defect status

| Severity | Item | Status |
|----------|------|--------|
| Critical | System CoA still in admin UI | **Fixed** |
| Critical | Unauthenticated test-delete | **Fixed** |
| High | Platform invoices using tenant AR | **Fixed** |
| High | Settings hardcoded / secret echo | **Fixed** |
| High | Mock random health / security / metrics | **Fixed** (honest empty or real counts) |
| High | Coarse admin RBAC on all mutating routes | **Mostly fixed** on hardened surfaces; some legacy routes still auth-only |
| Medium | Full form redesign on every page | **Open** — incremental |
| Medium | Admin session store for terminate | **Open** — 501 until model exists |

## Confirmations

- No System CoA nav/page content
- No false-zero inventoriable metrics on retired mock paths
- Secrets not returned from settings/email/android APIs
- Soft-archive tenants only; commission/payout/payment idempotency keys in place

## Ops note

`npx prisma generate` may EPERM on Windows while `npm run dev` locks the query engine DLL — stop the dev server first.
