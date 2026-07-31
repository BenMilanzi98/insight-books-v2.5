# Current Training Cohort Audit

**Audited:** 2026-07-31  
**Lens:** PRD Phase 22 Customer Training (tree phase-18 code alias)

| Check | Class | Evidence |
|-------|-------|----------|
| Cohort create + COH numbering | CORRECT_AND_REUSABLE / EXTEND | `cohorts.js` + allocateTrainingCohortNumber |
| Capacity | CORRECT_AND_REUSABLE / EXTEND | capacity Int; enrolment checks |
| Customer/Tenant scope | EXTEND | Via programAccess / listScope — fail-closed deepen |
| Unsafe multi-Customer mix | EXTEND | Must remain blocked by Program customer pin |

**Implication:** Cohort spine reusable; Wave 2 hardens scope + capacity edges.

