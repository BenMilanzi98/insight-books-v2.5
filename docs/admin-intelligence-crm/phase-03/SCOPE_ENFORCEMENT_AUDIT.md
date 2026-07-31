# Scope Enforcement Audit

| Asset | Finding | Class |
|-------|---------|-------|
| `ADMIN_SCOPES` | Tags defined | KEEP |
| `assertAdminScope` | Equality throw only; not data filters | EXTEND |
| `AdminTenantAccess` | Unused | CROSS_TENANT_RISK |
| Platform APIs | Implicit global tenant visibility for any permitted admin | CROSS_TENANT_RISK |
| Business/Branch/Team/Owner | No platform CRM resources yet | NOT_APPLICABLE (stub resolvers) |
| Support session tenant | Stored; not applied as query filter on tenant APIs | MISSING |

**Target:** Every platform-sensitive query carries explicit scope; TENANT lists honour AdminTenantAccess unless PLATFORM_GLOBAL grant; support context required for tenant-plane entry.
