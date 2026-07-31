# Current Tenant Hierarchy Audit

| Node | Status | Classification |
|------|--------|----------------|
| Tenant | Exists | CORRECT_AND_REUSABLE |
| Business model | **None** — Tenant acts as business | STANDARDISE (document; do not invent Business) |
| Branch | `Branch.tenantId` | CORRECT_AND_REUSABLE |
| User | `User.tenantId` | CORRECT_AND_REUSABLE |
| Cross-tenant FKs | Should be impossible by schema | VERIFY in Wave 1 tests |
