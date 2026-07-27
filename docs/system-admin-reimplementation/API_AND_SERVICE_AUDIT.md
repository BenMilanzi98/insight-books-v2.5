# API and Service Audit — `/api/admin` (~84 routes)

Inventory of `app/api/admin/**/route.js` (84 files). Auth patterns vary: `getAdminFromRequest` / `verifyAdminAuth`, raw `jwt.verify` + `decoded.isAdmin`, MRA EIS permission helpers, or **none**.

## Domain summary

### Auth (3) — KEEP

| Route | Classification | Notes |
|-------|----------------|-------|
| `auth/login` | KEEP | Sets `admin_token` cookie |
| `auth/logout` | KEEP | Clears cookie |
| `auth/me` | KEEP | Used by layout |

### Tenants (2+) — KEEP / EXTEND

| Route | Classification | Notes |
|-------|----------------|-------|
| `tenants` | KEEP | List/create/update family |
| `tenants/delete` | KEEP / SECURITY_RISK | Destructive; ensure Super Admin / permission |

### Users & roles (12) — EXTEND / STUB (roles)

| Route | Classification |
|-------|----------------|
| `users`, `users/create`, `users/update`, `users/delete`, `users/[userId]`, `users/actions`, `users/bulk`, `users/export`, `users/stats`, `users/[userId]/manual-activation` | KEEP / EXTEND |
| `users/roles` | STUB — mock role list |
| `users/test` | SECURITY_RISK / REMOVE — test surface |
| `roles` | INCOMPLETE — parallel role API |
| `departments`, `branches` | EXTEND — supporting lookups |

### Subscriptions & billing (10) — KEEP / DUPLICATE_BILLING_RISK

| Route | Classification | Notes |
|-------|----------------|-------|
| `subscriptions`, `subscriptions/update`, `subscriptions/delete` | KEEP | `AccountSubscription` |
| `eis-subscriptions`, `eis-subscriptions/deactivate` | KEEP | EIS entitlement billing hooks |
| `branch-subscriptions`, `branch-subscriptions/deactivate` | KEEP | |
| `trials/expire` | KEEP / EXTEND | Job-like |
| `invoices` | DUPLICATE_BILLING_RISK | Reads tenant `Invoice`, not platform ledger |
| *(payments)* | MISSING | No dedicated platform payments API |

### Affiliates (5) — KEEP

`affiliate`, `affiliate/update`, `affiliate/delete`, `affiliate/stats`, `affiliate/set-password` — KEEP.

### Mobile app (2 + Pages upload) — KEEP

`mobile-app`, `mobile-app/analytics` — KEEP. Upload also via `pages/api/admin/mobile-app/upload.js` (verifyAdminJwtToken).

### System CoA (4) — KEEP (locked)

| Route | Classification |
|-------|----------------|
| `system-coa` | KEEP |
| `system-coa/apply` | KEEP / CROSS_TENANT_RISK if misused |
| `system-coa/tenant-accounts` | KEEP |
| `coa-migration` | KEEP / SECURITY_RISK (powerful) |

### MRA EIS (11) — KEEP / EXTEND

`mra-eis/platform`, `entitlements`, `entitlements/[tenantId]`, `configuration`, `certifications`, `terminals`, `mappings`, `security/health`, `security/credentials/[id]`, `jobs/expire`, `jobs/bod-config-sync` — KEEP with `system.eis.*` checks (stronger than most admin domains).

### Email (2) — KEEP / EXTEND

`send-bulk-email`, `email-history` — KEEP.

### Audit (3) — KEEP / CONSOLIDATE

`audit/logs`, `audit/admin-logs`, `audit-logs` — KEEP canonical pair; consolidate naming.

### Security / monitoring (6) — EXTEND / INCOMPLETE

`security`, `security/settings`, `security/sessions`, `security/sessions/[id]`, `security/monitoring/events`, `security/monitoring/metrics`.

### Dashboard / metrics / analytics (12) — MIXED

| Route | Classification |
|-------|----------------|
| `dashboard/stats`, `dashboard/simple`, `dashboard/tenant-growth` | EXTEND |
| `dashboard/test`, `dashboard/debug` | SECURITY_RISK / REMOVE |
| `metrics`, `performance`, `performance/metrics` | EXTEND / INCOMPLETE |
| `analytics`, `analytics/engagement` | EXTEND |
| `system-health`, `system/info` | EXTEND |
| `reports`, `reports/available` | INCOMPLETE |

### Settings / maintenance / ops (6) — STUB / RISK

| Route | Classification |
|-------|----------------|
| `settings` | STUB — hardcoded response |
| `maintenance`, `backups`, `updates` | INCOMPLETE / SECURITY_RISK |
| `upload-attachment` | EXTEND / SECURITY_RISK (validate types/authz) |

### Test / debug (3+) — SECURITY_RISK / REMOVE

| Route | Classification | Finding |
|-------|----------------|---------|
| `test-delete` | SECURITY_RISK | **No auth** — returns success for GET/DELETE |
| `test-subscription-delete` | SECURITY_RISK | Test harness |
| `test-daily-report` | SECURITY_RISK | Super Admin check present in places; still not production |

## Auth pattern debt

| Pattern | Prevalence | Target |
|---------|------------|--------|
| `getAdminFromRequest` / `verifyAdminAuth` | Many stronger routes | KEEP as standard |
| Raw cookie JWT + `PrismaClient` per request | Legacy routes (metrics, settings, …) | REFACTOR → shared helper; stop `new PrismaClient()` |
| `requireAdminPermission` | Rare outside EIS | EXTEND with `systemAdmin.*` |
| No auth | `test-delete` et al. | REMOVE |

## Service layer notes

- MRA EIS: real application services under `lib/mraEis/**` — REUSE / KEEP.
- System CoA: `lib/systemCoaPayload` + apply/migration routes — KEEP.
- Subscriptions/affiliates: mostly route-local Prisma — REFACTOR toward services in Phases 3–5.
- No platform billing service — MISSING.

## Disposition by volume (approx.)

| Bucket | ~Routes | Action |
|--------|--------:|--------|
| KEEP / EXTEND (tenants, subs, affiliate, mobile, EIS, auth, email, system-coa) | ~45 | Harden + permissions |
| INCOMPLETE (security, dashboard, reports) | ~20 | Phase 6 |
| STUB (settings, users/roles) | ~3 | Reimplement |
| DUPLICATE_BILLING_RISK (invoices) | 1 | Replace domain |
| SECURITY_RISK / REMOVE (tests, debug) | ~8 | Phase 1 purge or lock down |
| Other supporting | ~7 | Case-by-case |
