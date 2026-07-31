# Current Training Enrolment Audit

**Audited:** 2026-07-31  
**Lens:** PRD Phase 22 Customer Training (tree phase-18 code alias)

| Check | Class | Evidence |
|-------|-------|----------|
| Enrol into cohort | CORRECT_AND_REUSABLE / EXTEND | `enrolment.js` enrolTrainingParticipant |
| Statuses ENROLLED/COMPLETED/WITHDRAWN/… | PARTIAL | TRAINING_ENROLMENT_STATUS — invitation states absent |
| Capacity + duplicate block | CORRECT_AND_REUSABLE / EXTEND | Enforced in enrolment.js |
| Idempotency | CORRECT_AND_REUSABLE / EXTEND | idempotencyKey unique |
| Waitlist | NOT_FOUND | No waitlist model/status |

**Implication:** Enrolment exists but invitation/registration/waitlist honesty is a Wave 2 Critical/High gap.

