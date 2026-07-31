# Current Branch Provisioning Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Branch model | FOUNDATION / CORRECT_AND_REUSABLE | `Branch` — `@@unique([tenantId, name])` |
| Tenant.defaultBranchId | FOUNDATION | Optional default |
| BranchSubscription | FOUNDATION | Branch-level SaaS add-on plane |
| Auto Branch on Tenant create | NOT_FOUND | Admin Tenant create does not create Branch |
| Conversion BRANCH step | NOT_FOUND | — |
| Cross-tenant Branch create | CROSS_TENANT_RISK if unguarded | Must bind tenantId from conversion lock |

**Implication:** Wave 2 create primary Branch when scope requires; BranchSubscription ≠ Platform Subscription truth.
