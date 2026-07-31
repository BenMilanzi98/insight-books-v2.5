# Current Onboarding Entitlement Readiness Audit

**Audited:** 2026-07-31  
**Domain root:** `lib/admin/customerSuccess/onboarding/`

| Check | Class | Evidence |
|-------|-------|----------|
| Dedicated entitlement readiness module | NOT_FOUND | No `lib/admin/customerSuccess/onboarding/readiness/entitlement.js` — entitlements inferred via subscription/config path |
| Config/subscription proxy | PARTIAL | `lib/admin/customerSuccess/onboarding/readiness/configuration.js` surfaces `entitlementsJson?.planCode` as evidence only |
| Unaccepted scope blocked | PARTIAL | `lib/admin/customerSuccess/onboarding/changeRequests.js` — `createOnboardingChangeRequest`; `lib/admin/customerSuccess/onboarding/scope.js` + `requirements.js` for scope items |
| Silent entitlement escalate | FORBIDDEN | Scope/CR path must never call `subscription.update` / UI term mutation of entitlements |
| UI term mutation of entitlements | FORBIDDEN | Never — entitlement changes only via governed subscription/CR acceptance outside onboarding UI terms |

**Gaps:** G21-09 → Wave 2.
