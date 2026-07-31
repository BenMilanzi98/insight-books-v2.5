# Current Training Curriculum Audit

**Audited:** 2026-07-31  
**Lens:** PRD Phase 22 Customer Training (tree phase-18 code alias)

| Check | Class | Evidence |
|-------|-------|----------|
| Curriculum + version models | CORRECT_AND_REUSABLE | Prisma CustomerTrainingCurriculum / CurriculumVersion |
| Wave1 onboarding seed | CORRECT_AND_REUSABLE / EXTEND | `curricula.js` ensureWave1OnboardingCurriculumVersion ACTIVE |
| ACTIVE immutability flag | PARTIAL / EXTEND | immutable Boolean on version; prove freeze on ACTIVE |
| Product module ≠ Training module | EXTEND | Module models present; explicit Product refs need honesty deepen |
| Rich multi-curriculum catalogue | PARTIAL | Seed focused on CUSTOMER_ONBOARDING_WAVE1 |

**Implication:** Curriculum pin exists for Program create; Wave 2 deepens version immutability and role-module binding.

