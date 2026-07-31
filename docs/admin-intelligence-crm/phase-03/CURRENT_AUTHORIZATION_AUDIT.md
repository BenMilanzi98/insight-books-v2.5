# Current Authorisation Audit — `/insightbooks`

**Audited:** 2026-07-28  
**Method:** Code inspection of auth, permissions, middleware, APIs, support access, scopes.

## Summary verdict

Solid Phase-2 foundations (JWT cookie, DB-backed Admin, granular `systemAdmin.*`, nav map, some API checks). **Not** enterprise Phase-3 ready: middleware cookie-presence-only, legacy JWT APIs, unused tenant ABAC, support access is audit/banner only, MFA/session revoke missing, SoD/field/access-review largely absent.

## Classification legend

KEEP · EXTEND · REFACTOR · REIMPLEMENT · MIGRATE · DEPRECATE · REMOVE · UNSAFE · CLIENT_ONLY_SECURITY · CROSS_TENANT_RISK · PRIVILEGE_ESCALATION_RISK · STALE_PERMISSION_RISK · AUDIT_GAP · MISSING · NOT_APPLICABLE

## Master inventory

| Piece | Path | Class |
|-------|------|-------|
| `verifyAdminJwtToken` DB reload | `lib/adminAuth.js` | KEEP |
| Login JWT + httpOnly cookie 24h | `app/api/admin/auth/login` | KEEP → EXTEND (jti/MFA) |
| `SYSTEM_ADMIN_PERMISSIONS` | `lib/admin/permissions.js` | KEEP |
| Super Admin always-allow | `adminHasPermission` | PRIVILEGE_ESCALATION_RISK → EXTEND (break-glass) |
| `NAV_PERMISSION_MAP` + tests | permissions + AdminSidebar | KEEP |
| Middleware cookie presence | `middleware.js` | UNSAFE → EXTEND |
| Layout `/me` | `app/insightbooks/layout.js` | CLIENT_ONLY_SECURITY |
| `AdminPermissionGate` | `components/admin/AdminPermissionGate.jsx` | CLIENT_ONLY_SECURITY |
| Legacy `jwt.verify`+`isAdmin` APIs | analytics, users/create/bulk, … | UNSAFE → REFACTOR |
| Auth-only sensitive stats | `dashboard/stats` | UNSAFE / EXTEND |
| `Admin` + `AdminAuditLog` | schema | KEEP |
| `AdminTenantAccess` | schema | MISSING runtime → EXTEND |
| `ADMIN_SCOPES` / `assertAdminScope` | `lib/admin/scopes.js` | EXTEND (tags only) |
| Support access API + banner | supportAccess + PlatformSupportAccess | KEEP/EXTEND |
| True tenant impersonation via support | — | MISSING |
| `superAdminProtection` | `lib/admin/superAdminProtection.js` | KEEP |
| Session revoke APIs | `security/sessions` | MISSING (501) |
| Admin MFA | settings defaults unused | MISSING |
| Multi-role / temp assignment | — | MISSING |
| SoD / field projection / access reviews | — | MISSING |
| Search permission scopes | `lib/admin/adminSearch.js` | KEEP → EXTEND ABAC |
| Export formula safety | `lib/admin/exportSafety.js` | KEEP |
| Tenant `securityGovernance` | `lib/securityGovernance/**` | KEEP separate |
| System CoA admin | REMOVED_ADMIN_ROUTES | KEEP removed |

## Five-question readiness

| Question | Today |
|----------|-------|
| Who is acting? | Admin id from JWT/DB; no real/effective split on most paths |
| What are they doing? | Ad hoc per route |
| What scope? | Implicit platform-global; AdminTenantAccess unused |
| Conditions? | isActive on modern path only; support TTL partial |
| Result? | Boolean allow/deny; no mask/aggregate/requireApproval |

Detail audits: sibling files in this folder. Defects: [SECURITY_DEFECT_REGISTER.md](./SECURITY_DEFECT_REGISTER.md).
