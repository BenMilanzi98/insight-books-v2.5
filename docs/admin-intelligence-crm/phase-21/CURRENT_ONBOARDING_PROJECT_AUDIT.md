# Current Onboarding Project Audit

**Audited:** 2026-07-31  
**Domain root:** `lib/admin/customerSuccess/onboarding/`

| Check | Class | Evidence |
|-------|-------|----------|
| ONB-YYYY-###### numbering | CORRECT_AND_REUSABLE | `lib/admin/customerSuccess/onboarding/numbering.js` (`allocateOnboardingProjectNumber`) / `projects.js` |
| Create after accepted Request | PARTIAL | `createOnboardingProject` in `lib/admin/customerSuccess/onboarding/projects.js`; harden post-accept gate |
| Template version pin required | PARTIAL | ACTIVE `templateVersionId` / `onboardingTemplateVersionId` required in `createOnboardingProject` |
| Idempotency key | PARTIAL | Exact retry by `idempotencyKey`; conflicting hash fail deepen |
| One active Project per handoff/customer | PARTIAL | Prove + harden Wave 1 |
| Status machine | PARTIAL | `lib/admin/customerSuccess/onboarding/status.js` — forbid illegal jumps Wave 1 |
| Never fabricates COMPLETED | CORRECT_AND_REUSABLE | Comments + `lib/admin/customerSuccess/onboarding/completion.js` separate module |
| UI project detail | FOUNDATION | `app/insightbooks/customer-success/onboarding/projects/[id]/**` |

**Gaps:** G21-04…G21-06 → Wave 1.
