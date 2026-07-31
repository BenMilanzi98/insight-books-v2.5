# Current Training Request Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| `CustomerTrainingRequest` model | NOT_FOUND | Absent from `prisma/schema.prisma` |
| TRQ-YYYY-###### numbering | NOT_FOUND | No Training Request sequence / numbering service |
| Request status machine | NOT_FOUND | Statuses NEW…CONVERTED_TO_PROGRAM per design — no implementation |
| API `training-requests` | NOT_FOUND | No `app/api/admin/customer-success/training-requests/**` |
| Accept / reject / validate | NOT_FOUND | No `acceptTrainingRequest` / `rejectTrainingRequest` |
| Onboarding Request as substitute | WRONG_DOMAIN | `CustomerOnboardingRequest` / `onboarding-requests` API ≠ Training Request |
| Source catalogue pins | NOT_FOUND | PHASE_16_TRAINING_HANDOFF etc. — Wave 1 catalogue |

**Implication:** Wave 1 greenfield Request model + numbering + validate/accept/reject + handoff consume; one Request → one Program.
