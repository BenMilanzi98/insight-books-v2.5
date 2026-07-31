# Current Adoption Routes Audit

**Audited:** 2026-07-31

| Route / API | Class | Evidence |
|-------------|-------|----------|
| `/insightbooks/customer-success/adoption` (+ children) | NOT_FOUND | No `app/insightbooks/customer-success/adoption/**` |
| `/api/admin/customer-success/adoption-requests` | NOT_FOUND | No matching route tree |
| `/api/admin/customer-success/adoption-plans` | NOT_FOUND | No matching route tree |
| `/api/admin/customer-success/adoption/**` | NOT_FOUND | No matching route tree |
| `/insightbooks/customer-success/training/**` | CORRECT_AND_REUSABLE consume | Programs/requests/completion/certificates/reports present under `app/insightbooks/customer-success/training/` |
| `/insightbooks/customer-success/onboarding/projects/[id]/handover` | CORRECT_AND_REUSABLE attach | `app/insightbooks/customer-success/onboarding/projects/[id]/handover/page.js` |
| `/insightbooks/customer-success/success-plans` | CORRECT_AND_REUSABLE Phase 8 | `app/insightbooks/customer-success/success-plans/page.js` |
| `/insightbooks/customer-success/playbooks` | CORRECT_AND_REUSABLE Phase 8 | `app/insightbooks/customer-success/playbooks/page.js` |
| `/insightbooks/customer-success/interventions` | CORRECT_AND_REUSABLE Phase 8 | `app/insightbooks/customer-success/interventions/page.js` |
| `/insightbooks/customer-success/handoffs` | REUSE_WITH_RECONCILIATION | `app/insightbooks/customer-success/handoffs/page.js` — CS expansion; distinct from Adoption expansion entity |
| `/api/admin/customer-success/plans` | CORRECT_AND_REUSABLE | `app/api/admin/customer-success/plans/route.js` |
| `/api/admin/customer-success/playbooks` | CORRECT_AND_REUSABLE | `app/api/admin/customer-success/playbooks/route.js` |
| `/api/admin/customer-success/interventions` | CORRECT_AND_REUSABLE | `app/api/admin/customer-success/interventions/route.js` |
| `/api/admin/customer-success/handoffs` | CORRECT_AND_REUSABLE | `app/api/admin/customer-success/handoffs/route.js` |
| `/insightbooks/intelligence/product-analytics/adoption` | CORRECT_AND_REUSABLE | Real inspect UI — not CS Adoption hub |
| `/insightbooks/intelligence/customers/adoption` | WRONG_DOMAIN | Stub page — must not redirect as Adoption SoT |
| Permissions map for CS adoption | NOT_FOUND | `lib/admin/permissions.js` has intelligence adoption routes; no CS `/customer-success/adoption` mapping yet |

**Implication:** Wave 1 adds thin CS adoption routes/APIs; Wave 4 deepens hubs. Keep Intelligence product-analytics as analytics home; never promote stub customer adoption as Plan truth.
