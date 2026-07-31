# Current Training Program Audit

**Audited:** 2026-07-31  
**Lens:** PRD Phase 22 Customer Training (tree phase-18 code alias)

| Check | Class | Evidence |
|-------|-------|----------|
| Program create + TRN numbering | CORRECT_AND_REUSABLE / EXTEND | `programs.js` + allocateTrainingProgramNumber |
| One Request → one Program | CORRECT_AND_REUSABLE | Prisma trainingRequestId @unique on CustomerTrainingProgram |
| Curriculum version pin | CORRECT_AND_REUSABLE / EXTEND | curriculumVersionId required FK |
| Status machine | PARTIAL / EXTEND | `status.js` canTransitionTrainingProgramStatus; deepen DRAFT→COMPLETED forbid |
| Idempotency | CORRECT_AND_REUSABLE / EXTEND | idempotencyKey unique; conflict fail pattern |
| Source from Phase 21 handoff | GAP | Programs today seeded via Phase 16 handoff / Request path — Phase 21 primary missing |
| COMPLETED_WITH_GAPS | CORRECT_AND_REUSABLE | TRAINING_PROGRAM_STATUS + completion.js |

**Implication:** Program spine reusable; Wave 1 must wire Phase 21 handoff as primary create source without fabricating COMPLETED.

