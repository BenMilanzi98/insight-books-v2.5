# Current Onboarding Architecture Audit (PRD 21)

**Audited:** 2026-07-31  
**Domain root:** `lib/admin/customerSuccess/onboarding/`

| Check | Class | Evidence |
|-------|-------|----------|
| Dual-entity Request/Project spine | CORRECT_AND_REUSABLE / EXTEND | CustomerOnboardingRequest + CustomerOnboardingProject in `prisma/schema.prisma`; `lib/admin/customerSuccess/onboarding/{requests,projects,status,numbering,model}.js` |
| Canonical domain path | CORRECT_AND_REUSABLE | `lib/admin/customerSuccess/onboarding/**` (~55 modules) — tree phase-17 ≡ PRD 21 |
| Domain contract | PARTIAL | `lib/admin/customerSuccess/onboarding/catalogue.js` honesty flags; still labels tree phase-17 — bump Wave 4 |
| Phase 20 handoff emit | CORRECT_AND_REUSABLE | `lib/admin/crm/conversions/onboardingHandoff.js` + `handoffShared.js` checksum / one-active |
| Handoff consume | PARTIAL | `lib/admin/customerSuccess/onboarding/handoffConsume.js` → Request; no dedicated accept+checksum validate API |
| UI hubs | FOUNDATION | `app/insightbooks/customer-success/onboarding/**` |
| APIs | FOUNDATION | `app/api/admin/customer-success/onboarding*/**` |
| Prior Vitest | CORRECT_AND_REUSABLE | `test/systemAdmin.cs.onboardingWave{1..4}.test.js` |
| Training / Adoption domains | FUTURE_PHASE_SCOPE | Must not redefine architecture |
| Parallel onboarding domain | FORBIDDEN | Never |

**Implication:** Harden existing spine (Approach 1). Docs re-home to `phase-21/`. Wave 1 targets accept/validate + Project edges.
