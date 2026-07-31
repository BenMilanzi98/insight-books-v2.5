# Current Onboarding Business / Branch Setup Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Onboarding business/branch readiness module | NOT_FOUND | Spec `readiness/businessBranch.js` absent |
| Conversion Business/Branch provision | CORRECT_AND_REUSABLE | `lib/admin/crm/conversions/businessBranch.js` |
| Expected vs actual vs accepted scope | NOT_FOUND | Scope confirmation Wave 2; readiness Wave 3 |
| CROSS_BUSINESS_RISK / CROSS_BRANCH_RISK | CROSS_BUSINESS_RISK / CROSS_BRANCH_RISK | Must assert accepted businesses/branches; no silent create outside conversion services |
| Silent Super Admin / bypass RBAC | FORBIDDEN | — |

**Implication:** Wave 3 readiness evaluates provisioned Business/Branch against Project scope; create/link remains conversion/provision services.
