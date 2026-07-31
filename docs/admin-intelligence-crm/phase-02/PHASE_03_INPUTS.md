# Phase 3 Inputs (from Phase 2)

## Must reuse

| Asset | Path |
|-------|------|
| Permission catalog | `lib/admin/permissions.js` |
| Nav + removed routes | `lib/admin/adminNav.js` |
| Auth helpers | `lib/adminAuth.js` |
| Scopes tags | `lib/admin/scopes.js` |
| Support helpers | `lib/admin/supportAccess.js` |
| Super Admin protection | `lib/admin/superAdminProtection.js` |
| Admin API client | `lib/admin/adminApi.js` |
| Search scopes | `lib/admin/adminSearch.js` |
| PermissionGate | `components/admin/AdminPermissionGate.jsx` |
| Support banner | `components/admin/AdminSupportAccessBanner.jsx` |
| Shell | `components/shell/AdminShell.jsx` |
| Phase 2 audits | `docs/admin-intelligence-crm/phase-02/*` |
| Phase 1 pack | `docs/admin-intelligence-crm/*.md` via `phase-01/README.md` |

## Must fix in Phase 3 (inherited debt)

- Middleware cookie-presence-only for `/insightbooks`
- Legacy JWT-only admin APIs
- Auth-only sensitive endpoints (dashboard stats metric keys unused)
- Support access ≠ tenant impersonation
- `AdminTenantAccess` unused
- No MFA / session revoke for admins
- Super Admin bypass vs default-deny / SoD

## Must not change

- Billing KPI source-of-truth (SaaS plane)
- System CoA admin removal
- Tenant accounting access model without support policy
