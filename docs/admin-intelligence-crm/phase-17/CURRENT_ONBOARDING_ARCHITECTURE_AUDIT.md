# Current Onboarding Architecture Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Dual-entity Request/Project spine | NOT_FOUND | No `CustomerOnboardingRequest` / `CustomerOnboardingProject` in `prisma/schema.prisma`; no `lib/admin/customerSuccess/onboarding/**` |
| Phase 16 ONBOARDING handoff emit | CORRECT_AND_REUSABLE | `lib/admin/crm/conversions/onboardingHandoff.js` → `createDomainHandoff` with type `ONBOARDING` |
| Handoff ≠ execute | CORRECT_AND_REUSABLE | `handoffShared.js` forces `executionStatus: NOT_STARTED`, `executesDomainWork: false`, `recordOnly: true` |
| Distinct TRAINING/MIGRATION/MRA handoffs | CORRECT_AND_REUSABLE | `trainingHandoff.js`, `migrationHandoff.js`, `mraEisHandoff.js` — separate `handoffType` values |
| Phase 8 checklist foundation | REUSE_WITH_RECONCILIATION | `CsOnboardingRecord` + `foundations.js` `getFoundationStatus`; empty → `NOT_INSTRUMENTED`; `progressPercent: null` |
| CS onboarding UI | DISCONNECTED / CLIENT_SIDE_ONLY foundations | `app/insightbooks/customer-success/onboarding/page.js` renders `CustomerSuccessFoundationsView kind="onboarding"` only |
| Foundations API | EXTEND | `app/api/admin/customer-success/foundations/route.js` |
| Route permission | EXTEND | `lib/admin/permissions.js` maps `/insightbooks/customer-success/onboarding` → `customerSuccess.read` — no `onboarding*` SoD perms yet |
| CS expansion handoff | WRONG_DOMAIN | `lib/admin/customerSuccess/handoffs.js` — expansion record-only ≠ Closed-Won onboarding |
| Conversion completion ≠ onboarding complete | CORRECT_AND_REUSABLE | `lib/admin/crm/conversions/completion.js` |
| Fabricated onboarding complete | FORBIDDEN | Handoff payload forces `onboardingCompleted: false` |

**Implication:** Wave 1 greenfield Request/Project under `lib/admin/customerSuccess/onboarding/*`; consume Phase 16 handoff; reconcile Phase 8 later (Wave 4). Do not treat foundations UI or expansion handoffs as the onboarding spine.
