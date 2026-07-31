# Current Training Architecture Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Dual-entity Request/Program spine | NOT_FOUND | No `CustomerTrainingRequest` / `CustomerTrainingProgram` in `prisma/schema.prisma`; no `lib/admin/customerSuccess/training/**` |
| Phase 16 TRAINING handoff emit | CORRECT_AND_REUSABLE | `lib/admin/crm/conversions/trainingHandoff.js` → `createDomainHandoff` type `TRAINING`; forces `trainingCompleted: false` |
| Handoff ≠ execute | CORRECT_AND_REUSABLE | `handoffShared.js` `serializeDomainHandoff` → `recordOnly: true`, `executesDomainWork: false`; executionStatus defaults NOT_STARTED |
| Phase 17 training coordination gate | CORRECT_AND_REUSABLE | `lib/admin/customerSuccess/onboarding/training.js` — COMPLETED requires Phase 18 domain source |
| Phase 8 checklist foundation | REUSE_WITH_RECONCILIATION | `CsTrainingRecord` + `foundations.js` `getFoundationStatus` kind=training; empty → `NOT_INSTRUMENTED`; `progressPercent: null` |
| CS training UI | DISCONNECTED / CLIENT_SIDE_ONLY foundations | `app/insightbooks/customer-success/training/page.js` renders `CustomerSuccessFoundationsView kind="training"` only |
| Foundations API | EXTEND | `app/api/admin/customer-success/foundations/route.js` |
| Route permission | EXTEND | `lib/admin/permissions.js` maps `/insightbooks/customer-success/training` → `customerSuccess.read` — no `training*` SoD perms yet |
| CS expansion handoff | WRONG_DOMAIN | `lib/admin/customerSuccess/handoffs.js` — expansion record-only ≠ Closed-Won TRAINING handoff |
| Onboarding Project as Training Program | WRONG_DOMAIN | `CustomerOnboardingProject` is onboarding spine — not Training Program |
| Fabricated training complete | FORBIDDEN | Handoff payload forces `trainingCompleted: false`; coordination rejects COMPLETED without domain source |

**Implication:** Wave 1 greenfield Request/Program under `lib/admin/customerSuccess/training/*`; consume Phase 16 TRAINING handoff; feed Phase 17 via typed service later; reconcile Phase 8 in Wave 4. Do not treat foundations UI or expansion handoffs as the Training spine.
