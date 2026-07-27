# System Admin Permission Audit

## Current mechanism

**File:** `lib/adminAuth.js`

```js
adminHasPermission(admin, permission) // "category.action"
// Super Admin → always true
// else admin.permissions[category][action] === true
```

Supporting helpers: `verifyAdminJwtToken`, `verifyAdminAuth`, `requireAdminAuth`, `requireAdminPermission`, `getAdminFromRequest`.

**Storage:** `Admin.permissions` JSON (default `{}`), `Admin.role` string (default `"Super Admin"`).

**Cookie / JWT:** `admin_token` with `isAdmin` + `adminId` claims.

## Super Admin bypass — KEEP with guardrails

| Finding | Impact |
|---------|--------|
| `admin.role === 'Super Admin'` short-circuits all permission checks | Operational convenience; hides missing catalog |
| Role is free-form string | Typos / alternate casings fail closed (good) or create shadow admins if data wrong |
| Most non-EIS routes only check `isAdmin` / cookie JWT | Any active Admin can hit powerful APIs |

**Classification:** SECURITY_RISK until fine-grained `systemAdmin.*` is enforced on mutating routes.

## What exists today: MRA EIS catalog only

`lib/mraEis/domain/permissions.js` defines a rich frozen catalog, e.g.:

- `system.eis.view`, `system.eis.platform.manage`, entitlement grant/suspend/revoke, …
- terminals, configuration, mappings, catalogue, migration, certification, release, …

EIS admin APIs and services call into this model (plus Super Admin bypass in domain helpers).

**There is no equivalent `systemAdmin.*` catalog** for:

- tenants.create / tenants.delete / tenants.impersonate
- subscriptions.manage / trials.expire
- affiliates.manage / affiliates.setPassword
- mobileApp.publish / mobileApp.forceLock
- billing.platformInvoice.*
- settings.write
- email.bulkSend
- systemCoa.read / systemCoa.apply / coa.migrate
- audit.read
- security.sessions.revoke
- users.manage (platform user ops)

## Mock roles API — STUB

`/api/admin/users/roles` returns hardcoded Super Admin / Admin / Manager / User / Guest with inventorial permission strings (`user_manage`, `all`, …) that **do not match** `adminHasPermission`'s `category.action` shape nor `system.eis.*`.

**Classification:** STUB / DISCONNECTED from real authorization.

## Middleware vs page vs API

| Layer | Check | Gap |
|-------|-------|-----|
| `middleware.js` | `admin_token` cookie present for `/insightbooks` | No JWT verify; no permission |
| `layout.js` | `/api/admin/auth/me` | Session only |
| AdminSidebar | None | All nav visible |
| Most `/api/admin/*` | Admin JWT / isAdmin | No action permission |
| MRA EIS APIs | `system.eis.*` (+ Super Admin) | Best practice island |

## Target permission catalog (Phase 1 scaffold)

Propose namespaced codes (store flat or nested consistently — pick one encoding for JSON):

| Code | Purpose |
|------|---------|
| `systemAdmin.access` | Enter admin app |
| `systemAdmin.tenants.view` / `.manage` / `.delete` | Tenant ops |
| `systemAdmin.users.manage` | Platform user management |
| `systemAdmin.subscriptions.manage` | Account/branch/EIS subscription ops |
| `systemAdmin.affiliates.manage` | Affiliate CRUD/payouts |
| `systemAdmin.mobileApp.manage` | Android rollout controls |
| `systemAdmin.email.send` | Bulk email |
| `systemAdmin.billing.view` / `.manage` | Platform invoices/payments |
| `systemAdmin.settings.manage` | Global settings |
| `systemAdmin.coa.read` / `.apply` | System CoA APIs (UI removed) |
| `systemAdmin.audit.view` | Audit logs |
| `systemAdmin.security.manage` | Sessions/monitoring |
| `systemAdmin.metrics.view` | Dashboards |
| *(retain)* `system.eis.*` | Unchanged EIS catalog |

Super Admin continues to bypass; non–Super Admin must have explicit grants. `AdminTenantAccess` may later scope tenant-specific views.

## Classification summary

| Item | Classification |
|------|----------------|
| `adminHasPermission` helper | KEEP / EXTEND |
| Super Admin bypass | KEEP (document + audit) / SECURITY_RISK if sole control |
| `system.eis.*` | KEEP / REUSE as pattern |
| `systemAdmin.*` catalog | MISSING → REIMPLEMENT |
| Sidebar permission filtering | MISSING → EXTEND |
| `users/roles` mock | STUB → REIMPLEMENT |
| Route-level `requireAdminPermission` adoption | INCOMPLETE |
