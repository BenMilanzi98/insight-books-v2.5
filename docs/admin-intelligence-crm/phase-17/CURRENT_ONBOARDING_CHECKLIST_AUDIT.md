# Current Onboarding Checklist Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Template checklist materialisation | NOT_FOUND | — |
| Phase 8 `CsOnboardingRecord.checklistKey` | REUSE_WITH_RECONCILIATION | Thin row: `checklistKey`, `status`, `completedAt`, `sourceNote` — not Project checklist |
| Empty checklist → NOT_INSTRUMENTED | CORRECT_AND_REUSABLE honesty | `getFoundationStatus` when no rows |
| Checklist complete from login/page views | FORBIDDEN | Documented Phase 8 + foundations meta `inventProgressForbidden: true` |

**Implication:** New checklist items live under Project materialisation; Phase 8 rows link or UNKNOWN in Wave 4 — never invent COMPLETED.
