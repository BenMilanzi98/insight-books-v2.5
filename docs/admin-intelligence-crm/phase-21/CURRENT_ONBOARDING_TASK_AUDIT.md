# Current Onboarding Task Audit

**Audited:** 2026-07-31  
**Domain root:** `lib/admin/customerSuccess/onboarding/`

| Check | Class | Evidence |
|-------|-------|----------|
| Model + evidence | CORRECT_AND_REUSABLE | CustomerOnboardingTask, CustomerOnboardingTaskEvidence, dependencies |
| Service | PARTIAL | `lib/admin/customerSuccess/onboarding/{tasks,evidence,dependencies,responsibilities}.js` |
| Customer evidence attestation | PARTIAL | Portal `CUSTOMER_PORTAL_NOT_CONFIGURED` |
| CRM Activities reuse | REUSE_WITH_RECONCILIATION | Phase 17 Activities — not CsTask expansion domain |
| Exact retry no duplicate tasks | PARTIAL | `lib/admin/customerSuccess/onboarding/materialise.js` harden |

**Class:** EXTEND. CARRY portal.
