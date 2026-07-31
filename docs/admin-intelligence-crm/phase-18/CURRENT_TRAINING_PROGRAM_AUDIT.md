# Current Training Program Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| `CustomerTrainingProgram` model | NOT_FOUND | Absent from schema |
| TRN-YYYY-###### numbering | NOT_FOUND | No Program sequence |
| `createCustomerTrainingProgram` | NOT_FOUND | No service under training domain |
| curriculumVersionId pin | NOT_FOUND | Required by design; no Program row |
| Program status machine | NOT_FOUND | No DRAFT→READY_TO_START→IN_PROGRESS→COMPLETED path; DRAFT→COMPLETED must fail |
| API `training-programs` | NOT_FOUND | No `app/api/admin/customer-success/training-programs/**` |
| Onboarding Project as Program | WRONG_DOMAIN | `CustomerOnboardingProject` (`ONB-`) is not Training Program |
| CsTrainingRecord as Program | REUSE_WITH_RECONCILIATION / WRONG_SOURCE | Thin module rows only — not Program spine; Wave 4 link |

**Implication:** Wave 1 Program create with pinned curriculum version + idempotency; Waves 2–3 add delivery/completion truth.
