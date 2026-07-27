# Security Risk Register (System Admin)

| ID | Risk | Evidence | Severity | Classification | Phase |
|----|------|----------|----------|----------------|-------|
| SEC-01 | Unauthenticated test DELETE endpoint | `app/api/admin/test-delete/route.js` — no auth on GET/DELETE | Critical | SECURITY_RISK / REMOVE | 1 |
| SEC-02 | Other test/debug admin routes | `test-subscription-delete`, `dashboard/test`, `dashboard/debug`, `users/test` | High | SECURITY_RISK | 1 |
| SEC-03 | Middleware only checks cookie presence | `middleware.js` `/insightbooks` block — no JWT verify | High | SECURITY_RISK | 1 |
| SEC-04 | Most APIs authorize any active Admin | Missing `requireAdminPermission` outside EIS | High | SECURITY_RISK | 1–3 |
| SEC-05 | Super Admin string bypass is primary control | `adminHasPermission` | Medium | SECURITY_RISK (until catalog) | 1 |
| SEC-06 | Hardcoded settings expose SMTP / infra shape | `/api/admin/settings` returns static SMTP host/user, pool sizes | Medium | SECURITY_RISK / STUB | 5–6 |
| SEC-07 | Global settings UI pretends to save security flags | `global-settings` alert-save; 2FA/session fields not persisted | Medium | STUB / SECURITY_RISK | 5–6 |
| SEC-08 | Powerful CoA apply/migration without fine permissions | `system-coa/apply`, `coa-migration` | High | SECURITY_RISK / CROSS_TENANT_RISK | 1 |
| SEC-09 | Bulk email as any admin | `send-bulk-email` | Medium | SECURITY_RISK | 3 |
| SEC-10 | Affiliate set-password | `affiliate/set-password` | Medium | SECURITY_RISK | 3 |
| SEC-11 | Manual user activation | `users/[userId]/manual-activation` | Medium | SECURITY_RISK | 3 |
| SEC-12 | Upload attachment / APK upload | `upload-attachment`, Pages mobile upload | Medium | SECURITY_RISK | 3 |
| SEC-13 | New PrismaClient per request + disconnect | Many legacy routes | Low | REFACTOR (reliability/DoS-adjacent) | 2 |
| SEC-14 | Mock audit-logs / affiliate-system may train bad trust | Stub pages look “real” | Low | STUB / REMOVE | 1 |
| SEC-15 | AdminActivityLog FK to User not Admin | Schema confusion for audit integrity | Low | DATA / REFACTOR | 6 |
| SEC-16 | SecV2 impersonation / emergency models underused in admin UI | Models exist; incomplete controls UI | Medium | INCOMPLETE | 6 |

## Immediate Phase 1 actions

1. Delete or hard-gate SEC-01/SEC-02 behind non-production env + Super Admin.
2. Validate JWT in middleware or edge-compatible verify path.
3. Scaffold `systemAdmin.*` and apply to destructive routes (tenant delete, CoA apply, migration, test report).
4. Remove stub duplicate pages from nav/routes.

## Residual acceptance

Super Admin bypass remains allowed after Phase 1 if: (a) role assignment is tightly controlled, (b) AdminAuditLog covers mutations, (c) non–Super Admin paths enforce catalog.
