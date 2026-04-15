# Admin API reference (`admin2.md`)

This document lists **InsightBooks admin HTTP APIs** under `/api/admin/**`, plus the **Pages Router** admin upload route. It reflects the App Router layout in `app/api/admin/` as of the date this file was generated.

---

## UI and base URL

| Item | Value |
|------|--------|
| Admin web app | `/insightbooks/*` (login: `/insightbooks/login`) |
| API base | Same origin as the site, path prefix **`/api/admin`** |
| Primary auth | HTTP-only cookie **`admin_token`** (JWT) set by **`POST /api/admin/auth/login`** |

---

## Authentication summary

| Pattern | Cookie / header | Used by |
|---------|------------------|---------|
| **Admin JWT** | `admin_token` (httpOnly, `path: /`) | Almost all routes below; verified with `getAdminFromRequest()` from `@/lib/adminAuth` **or** manual `jwt.verify(..., getJwtSecret())` with `decoded.isAdmin === true`. |
| **Public** | — | `POST /api/admin/auth/login` (credentials in JSON body). `GET /api/admin/auth/login` returns a short message. `GET`/`DELETE` **`/api/admin/test-delete`** has **no** auth (diagnostic only). |
| **Tenant session (exception)** | `session` (tenant app cookie) | **`/api/admin/trials/expire`** — uses `getUserFromSession` and requires **`user.role.name === 'MASTER_ADMIN'`** (platform master user, **not** the InsightBooks admin panel JWT). |

**JWT signing:** Server uses `JWT_SECRET` or falls back to `SESSION_SECRET` (each ≥ 16 chars). See `lib/serverJwtSecret.js`.

**Client calls:** Use `credentials: 'include'` on `fetch` so `admin_token` is sent.

---

## App Router routes (`app/api/admin/.../route.js`)

Grouped by feature. **Auth** = `admin_token` unless noted.

### Authentication

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/admin/auth/login` | Public | Email/password → sets `admin_token`, returns admin profile (no password). |
| `GET` | `/api/admin/auth/login` | Public | Placeholder / health message for the login route. |
| `POST` | `/api/admin/auth/logout` | Admin JWT | Clears `admin_token`. |
| `GET` | `/api/admin/auth/logout` | Public | Logout info (see route). |
| `GET` | `/api/admin/auth/me` | Admin JWT | Current admin from cookie; `401` if not authenticated. |

### Dashboard and metrics

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/admin/dashboard/stats` | Admin | Aggregate dashboard statistics. |
| `GET` | `/api/admin/dashboard/simple` | Admin | Simplified dashboard payload. |
| `GET` | `/api/admin/dashboard/tenant-growth` | Admin | Tenant growth metrics. |
| `GET` | `/api/admin/dashboard/debug` | Admin | Debug snapshot (no request body). |
| `GET` | `/api/admin/dashboard/test` | Admin | Test/diagnostic dashboard endpoint. |
| `GET` | `/api/admin/metrics` | Admin JWT (manual verify) | Admin metrics. |
| `GET` | `/api/admin/performance` | Admin JWT (manual) | Performance summary. |
| `GET` | `/api/admin/performance/metrics` | Admin JWT (manual) | Performance metrics. |
| `GET` | `/api/admin/analytics` | Admin JWT (manual) | Analytics data. |
| `GET` | `/api/admin/system-health` | Admin | System health check. |
| `GET` | `/api/admin/system/info` | Admin JWT (manual) | System information. |

### Tenants, branches, subscriptions

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/admin/tenants` | Admin | List tenants with subscription-derived status. |
| `POST` | `/api/admin/tenants` | Admin JWT (manual) | Create tenant (and related bootstrap per route). |
| `POST` | `/api/admin/tenants/delete` | Admin JWT (manual) | Delete tenant (body per route). |
| `GET` | `/api/admin/branches` | Admin | List branches (cross-tenant admin view). |
| `GET` | `/api/admin/subscriptions` | Admin | List / query subscriptions. |
| `POST` | `/api/admin/subscriptions` | Admin | Subscription actions (create/update per body). |
| `POST` | `/api/admin/subscriptions/update` | Admin | Update subscription. |
| `POST` | `/api/admin/subscriptions/delete` | Admin | Delete subscription. |
| `GET` | `/api/admin/branch-subscriptions` | Admin | Branch subscription listing. |
| `POST` | `/api/admin/branch-subscriptions` | Admin | Create / manage branch subscriptions. |
| `POST` | `/api/admin/branch-subscriptions/deactivate` | Admin | Deactivate branch subscription. |
| `GET` | `/api/admin/eis-subscriptions` | Admin | MRA EIS subscription listing. |
| `POST` | `/api/admin/eis-subscriptions` | Admin | EIS subscription actions. |
| `POST` | `/api/admin/eis-subscriptions/deactivate` | Admin | Deactivate EIS subscription. |
| `GET` | `/api/admin/trials/expire` | **Tenant `MASTER_ADMIN`** | List tenants with expired trials. |
| `POST` | `/api/admin/trials/expire` | **Tenant `MASTER_ADMIN`** | Trial expiration actions (`action`, `tenantId` in body). |

### Users, roles, departments

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/admin/users` | Admin | Paginated/filtered user list. |
| `POST` | `/api/admin/users` | Admin | User list mutations or filter (see route). |
| `POST` | `/api/admin/users/create` | Admin JWT (manual) | Create user / tenant user. |
| `POST` | `/api/admin/users/update` | Admin | Update user. |
| `POST` | `/api/admin/users/delete` | Admin | Delete user. |
| `POST` | `/api/admin/users/bulk` | Admin JWT (manual) | Bulk user operations. |
| `POST` | `/api/admin/users/export` | Admin JWT (manual) | Export users (CSV or JSON per route). |
| `POST` | `/api/admin/users/actions` | Admin JWT (manual) | Miscellaneous user actions. |
| `GET` | `/api/admin/users/stats` | Admin | User statistics. |
| `GET` | `/api/admin/users/test` | Admin | Simple connectivity test. |
| `GET` | `/api/admin/users/roles` | Admin JWT (manual) | Roles for user management UI. |
| `POST` | `/api/admin/users/roles` | Admin JWT (manual) | Assign/update roles. |
| `GET` | `/api/admin/roles` | Admin | List roles. |
| `POST` | `/api/admin/roles` | Admin | Create/update roles. |
| `GET` | `/api/admin/departments` | Admin | List departments. |
| `POST` | `/api/admin/departments` | Admin | Create/update departments. |

### Affiliate (admin-managed)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/admin/affiliate` | Admin | List affiliates. |
| `POST` | `/api/admin/affiliate` | Admin | Create affiliate. |
| `POST` | `/api/admin/affiliate/update` | Admin | Update affiliate. |
| `POST` | `/api/admin/affiliate/delete` | Admin | Delete affiliate. |
| `GET` | `/api/admin/affiliate/stats` | Admin | Affiliate statistics. |
| `POST` | `/api/admin/affiliate/set-password` | Admin | Set affiliate password. |

### Security, sessions, audit

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/admin/security` | Admin JWT (manual) | Security overview / status. |
| `GET` | `/api/admin/security/settings` | Admin | Security settings. |
| `POST` | `/api/admin/security/settings` | Admin | Update security settings. |
| `GET` | `/api/admin/security/sessions` | Admin | Active sessions list. |
| `DELETE` | `/api/admin/security/sessions/[id]` | Admin | Revoke/end session by id (`[id]` = dynamic segment). |
| `GET` | `/api/admin/security/monitoring/events` | Admin | Security monitoring events. |
| `GET` | `/api/admin/security/monitoring/metrics` | Admin | Security monitoring metrics. |
| `GET` | `/api/admin/audit-logs` | Admin JWT (manual) | Audit logs (legacy/general). |
| `GET` | `/api/admin/audit/logs` | Admin | Audit logs. |
| `GET` | `/api/admin/audit/admin-logs` | Admin | Admin-specific audit log entries. |

### Settings, maintenance, backups, updates

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/admin/settings` | Admin JWT (manual) | Application settings. |
| `PUT` | `/api/admin/settings` | Admin JWT (manual) | Update settings. |
| `GET` | `/api/admin/maintenance` | Admin JWT (manual) | Maintenance dashboard data (tasks + process info; largely static template in code). |
| `GET` | `/api/admin/backups` | Admin JWT (manual) | List backups. |
| `POST` | `/api/admin/backups` | Admin JWT (manual) | Trigger / record backup (per route). |
| `GET` | `/api/admin/updates` | Admin JWT (manual) | List “updates” (mock/static list in code). |
| `POST` | `/api/admin/updates` | Admin JWT (manual) | Simulate install / update action (per route). |

### Reports, email, invoices, attachments

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/admin/reports` | Admin JWT (manual) | Reports list (`status`, `type`, `dateRange` query params; includes mock data). |
| `POST` | `/api/admin/reports` | Admin JWT (manual) | Report actions (generate/download per route). |
| `GET` | `/api/admin/reports/available` | Admin JWT (manual) | Available report types. |
| `GET` | `/api/admin/email-history` | Admin | Sent email history. |
| `POST` | `/api/admin/send-bulk-email` | Admin | Send bulk email campaign. |
| `GET` | `/api/admin/invoices` | Admin | Admin view of invoices. |
| `POST` | `/api/admin/upload-attachment` | Admin | Upload attachment for admin workflows. |

### Mobile app (release / APK)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/admin/mobile-app` | Admin | Read `MobileAppConfig` + on-disk release APK stats. |
| `POST` | `/api/admin/mobile-app` | Admin | Update version, URLs, grace period, locks, publish flags (JSON body; see inline comments in route). |

### Test / diagnostic (non-production use)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET` | `/api/admin/test-delete` | **None** | Confirms routing for GET. |
| `DELETE` | `/api/admin/test-delete` | **None** | Confirms DELETE handler. |
| `GET` | `/api/admin/test-subscription-delete` | Admin JWT (manual) | Test subscription delete flow. |
| `POST` | `/api/admin/test-subscription-delete` | Admin JWT (manual) | Test subscription delete. |
| `GET` | `/api/admin/test-daily-report` | Admin JWT (manual) | Test daily report. |
| `POST` | `/api/admin/test-daily-report` | Admin JWT (manual) | Trigger test daily report. |

---

## Pages Router (`pages/api/admin/`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | **`/api/admin/mobile-app/upload`** | `admin_token` → `verifyAdminJwtToken` | **Multipart** APK upload (`bodyParser: false`); field `apk`; uses Busboy; large payloads need proxy limits. Implemented in `pages/api/admin/mobile-app/upload.js`. |

---

## Alphabetical index (App Router)

Use this for quick lookup. **`[id]`** = dynamic route segment.

| Method | Path |
|--------|------|
| `GET` | `/api/admin/affiliate` |
| `POST` | `/api/admin/affiliate` |
| `POST` | `/api/admin/affiliate/delete` |
| `POST` | `/api/admin/affiliate/set-password` |
| `GET` | `/api/admin/affiliate/stats` |
| `POST` | `/api/admin/affiliate/update` |
| `GET` | `/api/admin/analytics` |
| `GET` | `/api/admin/audit-logs` |
| `GET` | `/api/admin/audit/admin-logs` |
| `GET` | `/api/admin/audit/logs` |
| `GET` | `/api/admin/auth/login` |
| `POST` | `/api/admin/auth/login` |
| `GET` | `/api/admin/auth/logout` |
| `POST` | `/api/admin/auth/logout` |
| `GET` | `/api/admin/auth/me` |
| `GET` | `/api/admin/backups` |
| `POST` | `/api/admin/backups` |
| `GET` | `/api/admin/branch-subscriptions` |
| `POST` | `/api/admin/branch-subscriptions` |
| `POST` | `/api/admin/branch-subscriptions/deactivate` |
| `GET` | `/api/admin/branches` |
| `GET` | `/api/admin/dashboard/debug` |
| `GET` | `/api/admin/dashboard/simple` |
| `GET` | `/api/admin/dashboard/stats` |
| `GET` | `/api/admin/dashboard/tenant-growth` |
| `GET` | `/api/admin/dashboard/test` |
| `GET` | `/api/admin/departments` |
| `POST` | `/api/admin/departments` |
| `GET` | `/api/admin/eis-subscriptions` |
| `POST` | `/api/admin/eis-subscriptions` |
| `POST` | `/api/admin/eis-subscriptions/deactivate` |
| `GET` | `/api/admin/email-history` |
| `GET` | `/api/admin/invoices` |
| `GET` | `/api/admin/maintenance` |
| `GET` | `/api/admin/metrics` |
| `GET` | `/api/admin/mobile-app` |
| `POST` | `/api/admin/mobile-app` |
| `GET` | `/api/admin/performance` |
| `GET` | `/api/admin/performance/metrics` |
| `GET` | `/api/admin/reports` |
| `POST` | `/api/admin/reports` |
| `GET` | `/api/admin/reports/available` |
| `GET` | `/api/admin/roles` |
| `POST` | `/api/admin/roles` |
| `GET` | `/api/admin/security` |
| `GET` | `/api/admin/security/monitoring/events` |
| `GET` | `/api/admin/security/monitoring/metrics` |
| `GET` | `/api/admin/security/settings` |
| `POST` | `/api/admin/security/settings` |
| `GET` | `/api/admin/security/sessions` |
| `DELETE` | `/api/admin/security/sessions/[id]` |
| `POST` | `/api/admin/send-bulk-email` |
| `GET` | `/api/admin/settings` |
| `PUT` | `/api/admin/settings` |
| `GET` | `/api/admin/subscriptions` |
| `POST` | `/api/admin/subscriptions` |
| `POST` | `/api/admin/subscriptions/delete` |
| `POST` | `/api/admin/subscriptions/update` |
| `GET` | `/api/admin/system-health` |
| `GET` | `/api/admin/system/info` |
| `GET` | `/api/admin/tenants` |
| `POST` | `/api/admin/tenants` |
| `POST` | `/api/admin/tenants/delete` |
| `GET` | `/api/admin/test-daily-report` |
| `POST` | `/api/admin/test-daily-report` |
| `GET` | `/api/admin/test-delete` |
| `DELETE` | `/api/admin/test-delete` |
| `GET` | `/api/admin/test-subscription-delete` |
| `POST` | `/api/admin/test-subscription-delete` |
| `GET` | `/api/admin/trials/expire` |
| `POST` | `/api/admin/trials/expire` |
| `GET` | `/api/admin/updates` |
| `POST` | `/api/admin/updates` |
| `POST` | `/api/admin/upload-attachment` |
| `GET` | `/api/admin/users` |
| `POST` | `/api/admin/users` |
| `POST` | `/api/admin/users/actions` |
| `POST` | `/api/admin/users/bulk` |
| `POST` | `/api/admin/users/create` |
| `POST` | `/api/admin/users/delete` |
| `POST` | `/api/admin/users/export` |
| `GET` | `/api/admin/users/roles` |
| `POST` | `/api/admin/users/roles` |
| `GET` | `/api/admin/users/stats` |
| `GET` | `/api/admin/users/test` |
| `POST` | `/api/admin/users/update` |

**Plus:** `POST /api/admin/mobile-app/upload` (Pages Router, see above).

---

## Android app

The Flutter app uses **tenant** APIs (e.g. `/api/auth/login`), **not** `/api/admin/auth/login`. Admin panel is web-only unless a separate admin client is added.

---

## Implementation notes

1. **Two verification styles:** Many routes call `getAdminFromRequest(request)` (loads admin from DB after JWT verify). Others inline `jwt.verify` on `admin_token` and check `decoded.isAdmin`. Behavior should be equivalent for valid tokens.
2. **Permissions:** Some routes may check `admin.role` or `admin.permissions` (see individual files). Super Admin role is treated as full access where `adminHasPermission` is used (`lib/adminAuth.js`).
3. **Mock / static data:** Several admin UIs are backed by placeholder arrays (e.g. parts of `reports`, `updates`, `maintenance` tasks). Treat responses as **UI demos** until wired to real persistence.
4. **Middleware:** Browser navigation under `/insightbooks` (except `/insightbooks/login`) expects `admin_token`; API routes under `/api` are not blocked by that layout but still require the cookie where documented.

---

## Regenerating this list

From the repo root (PowerShell):

```powershell
Get-ChildItem -Path app/api/admin -Recurse -Filter route.js | ForEach-Object { $_.FullName }
```

Cross-check exports (example):

```powershell
rg "^export async function (GET|POST|PUT|PATCH|DELETE)" app/api/admin
```
