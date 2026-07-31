# Repository Scope Audit

| Finding | Class |
|---------|-------|
| Most admin routes query Prisma directly without tenant allow-list | CROSS_TENANT_RISK |
| `AdminTenantAccess` never applied as `where: { tenantId: { in: … } }` | MISSING |
| Super Admin / PLATFORM_GLOBAL intended to see all | KEEP (explicit) |
| No `withAdminScope` helper | MISSING |

**Target:** `withAdminTenantFilter(actor, baseWhere)` mandatory for TENANT_SCOPED lists.
