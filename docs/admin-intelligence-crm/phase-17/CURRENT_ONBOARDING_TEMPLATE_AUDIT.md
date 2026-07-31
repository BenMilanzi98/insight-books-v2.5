# Current Onboarding Template Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Onboarding Template / TemplateVersion models | NOT_FOUND | — |
| Type catalogue (STANDARD, EXPRESS, MRA_EIS, …) | NOT_FOUND | Spec catalogue only; CS `catalogue.js` has foundation kinds, not onboarding types |
| Version immutability once ACTIVE | NOT_FOUND | — |
| Applicability by product/plan/segment | NOT_FOUND | — |
| Approval lifecycle DRAFT→ACTIVE→RETIRED | NOT_FOUND | — |
| `materialiseOnboardingTemplate` | NOT_FOUND | — |
| Seeded STANDARD template for Wave 1 Project pin | NOT_FOUND | Plan requires Wave-1 seeded ACTIVE STANDARD version |
| Template UI / APIs | NOT_FOUND | No `onboarding-templates/**` |

**Implication:** Wave 1 seed minimal ACTIVE STANDARD template version so Project always pins `templateVersionId`; Wave 2 full template/materialise.
