# Current Adoption ← Onboarding Handover Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Handover service | CORRECT_AND_REUSABLE | `lib/admin/customerSuccess/onboarding/handover.js` — create/accept |
| Handover UI | CORRECT_AND_REUSABLE | `app/insightbooks/customer-success/onboarding/projects/[id]/handover/page.js` |
| Onboarding completion | WRONG_DOMAIN as Adoption Plan COMPLETED | `onboarding/completion.js` — Project completion ≠ Plan COMPLETED |
| Onboarding readiness | WRONG_DOMAIN as product adoption | `onboarding/readiness/evaluate.js` — go-live readiness ≠ Adoption milestones |
| Training coordination | CORRECT_AND_REUSABLE / WRONG_SOURCE for ADR auto | `onboarding/training.js` — coordination COMPLETED requires Phase 18 domain source; does not create Adoption Request |
| `attachOnboardingHandoverToAdoption` | NOT_FOUND | Wave 1 greenfield |
| Handover accepted → Plan COMPLETED | FORBIDDEN | Attach only |
| Handover invents Training COMPLETED | FORBIDDEN | Design lock |

**Implication:** Wave 1 attach stores handover/project refs on Request or Plan; never sets Training COMPLETED; never transitions Plan to COMPLETED from attach alone.
