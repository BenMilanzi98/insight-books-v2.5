# Current Training Exercise Audit

**Audited:** 2026-07-31  
**Lens:** PRD Phase 22 Customer Training (tree phase-18 code alias)

| Check | Class | Evidence |
|-------|-------|----------|
| Exercise service | PARTIAL / EXTEND | `exercises.js` + CustomerTrainingExercise |
| Practice environment | PARTIAL / EXTEND | `environment.js` — Production data forbidden flag in domain contract |
| Statuses SUBMITTED/PASSED/WAIVED/… | CORRECT_AND_REUSABLE | TRAINING_EXERCISE_STATUS |
| Uncontrolled Production journals | FORBIDDEN | Domain contract tenantGlForbidden / productionDataInPracticeEnvForbidden |

**Implication:** Exercises EXTEND in Wave 3; never treat exercise pass as Program COMPLETED alone.

