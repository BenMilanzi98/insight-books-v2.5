# Assignment Model Audit

| Mechanism | Status | Class |
|-----------|--------|-------|
| `Admin.role` string | Live | EXTEND |
| `Admin.permissions` JSON | Live | MIGRATE → dual-read with assignments |
| `AdminTenantAccess` | Schema only; unused in app code | EXTEND or REMOVE |
| Temporary role grants | Missing | MISSING |
| Assignment approvals | Missing | MISSING |
| Multiple concurrent roles | Missing | MISSING |
| Support session as assignment | TTL session, not a role | EXTEND (privilege ceiling) |

**Target:** `PlatformRoleAssignment` (adminId, roleCode, version, validFrom/To, approvedBy, reason) + optional tenant scope rows; keep JSON dual-read until cutover.
