# Current Onboarding Template Audit

**Audited:** 2026-07-31  
**Domain root:** `lib/admin/customerSuccess/onboarding/`

| Check | Class | Evidence |
|-------|-------|----------|
| Template + Version models | CORRECT_AND_REUSABLE | CustomerOnboardingTemplate, CustomerOnboardingTemplateVersion |
| Services | PARTIAL | `lib/admin/customerSuccess/onboarding/templates.js`, `templateVersions.js` |
| ACTIVE immutable once applied | PARTIAL | Pattern present — harden |
| Materialise once | PARTIAL | `lib/admin/customerSuccess/onboarding/materialise.js` + CustomerOnboardingMaterialisation |
| Seeded STANDARD template | FOUNDATION | Wave1 STANDARD template code in `catalogue.js` |
| Historical Projects retain version | PARTIAL | Pin on Project — prove |

**Gaps:** G21-06 → Waves 1–2.
