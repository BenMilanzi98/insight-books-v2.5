# Current Adoption Request Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| `CustomerAdoptionRequest` model | NOT_FOUND | Absent from `prisma/schema.prisma` |
| ADR numbering | NOT_FOUND | — |
| Request status history | NOT_FOUND | — |
| `consumeTrainingCompletionForAdoption` | NOT_FOUND | — |
| `createManualAdoptionRequest` | NOT_FOUND | — |
| `acceptAdoptionRequest` / `rejectAdoptionRequest` | NOT_FOUND | — |
| Request APIs / UI | NOT_FOUND | — |
| Training Program as Request pin source | CORRECT_AND_REUSABLE | `training/programs.js` + completion status |
| CS Case / Support as auto Request | WRONG_DOMAIN | Manual/approved sources only unless design source enum allows gated create |
| Exact-retry idempotency | NOT_FOUND | Wave 1 requirement |

**Implication:** Wave 1 greenfield Request spine with source enum, pins, status machine, and Training COMPLETED consume.
