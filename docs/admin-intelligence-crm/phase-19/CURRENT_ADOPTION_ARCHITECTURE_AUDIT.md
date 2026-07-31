# Current Adoption Architecture Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Dual-entity Request/Plan spine | NOT_FOUND | No `CustomerAdoptionRequest` / `CustomerAdoptionPlan` in `prisma/schema.prisma`; no `lib/admin/customerSuccess/adoption/**` |
| Phase 18 Training COMPLETED seed | CORRECT_AND_REUSABLE | `lib/admin/customerSuccess/training/completion.js` → `evaluateProgramCompletion`; status `COMPLETED` vs `COMPLETED_WITH_GAPS` |
| Training → onboarding feed honesty | CORRECT_AND_REUSABLE | `training/onboardingFeed.js` — does **not** mark onboarding Project COMPLETED |
| Phase 17 handover attach surface | CORRECT_AND_REUSABLE | `lib/admin/customerSuccess/onboarding/handover.js` — `createOnboardingHandover` / `acceptOnboardingHandover` |
| Phase 8 Success Plan / Playbook / Intervention | REUSE_WITH_RECONCILIATION | `plans.js`, `playbooks.js`, `interventions.js` + Prisma models; no `adoptionPlanId` yet |
| Phase 9 product-analytics evidence | CORRECT_AND_REUSABLE | `lib/admin/productAnalytics/{firstValue,adoption,signals}.js` — read-only for Adoption |
| CS Adoption UI / API | NOT_FOUND | No `app/insightbooks/customer-success/adoption/**`; no `app/api/admin/customer-success/adoption*` |
| Intelligence customers adoption | WRONG_DOMAIN / CLIENT_SIDE_ONLY | `app/insightbooks/intelligence/customers/adoption/page.js` → `CustomerStubView` |
| Intelligence product-analytics adoption | CORRECT_AND_REUSABLE | `app/insightbooks/intelligence/product-analytics/adoption/page.js` — analytics home |
| CRM customer.adoption pack | DISCONNECTED / WRONG_SOURCE | `lib/admin/customers/overviewPack.js` — `status: UNAVAILABLE`, reason `FEATURE_USED not emitted` |
| CS expansion handoff | WRONG_DOMAIN as Adoption Plan spine | `lib/admin/customerSuccess/handoffs.js` — record-only expansion ≠ Adoption Request/Plan |
| Fabricated Plan COMPLETED from Phase 8 | FORBIDDEN | Historical Success Plan COMPLETED must not invent Adoption Plan COMPLETED |

**Implication:** Wave 1 greenfield Request/Plan under `lib/admin/customerSuccess/adoption/*`; consume Training Program `COMPLETED` only; attach onboarding handover; link Phase 8 in Waves 3–4; consume Phase 9 as evidence in Wave 2. Do not treat Intelligence stub, CRM UNAVAILABLE pack, or Phase 8 Success Plan as the Adoption spine.
