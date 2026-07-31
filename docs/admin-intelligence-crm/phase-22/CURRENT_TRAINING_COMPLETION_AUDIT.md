# Current Training Completion Audit

**Audited:** 2026-07-31  
**Lens:** PRD Phase 22 Customer Training (tree phase-18 code alias)

| Check | Class | Evidence |
|-------|-------|----------|
| Participant + Program completion | CORRECT_AND_REUSABLE / EXTEND | `completion.js` + ParticipantCompletion / ProgramCompletion models |
| Policy version | CORRECT_AND_REUSABLE | TRAINING_COMPLETION_POLICY_V1 |
| UNKNOWN ≠ COMPLETED | CORRECT_AND_REUSABLE | TRAINING_COMPLETION_STATUS includes UNKNOWN |
| COMPLETED_WITH_GAPS | CORRECT_AND_REUSABLE | Explicit status — onboardingFeed maps to READY not COMPLETED |
| Onboarding auto-complete forbid | CORRECT_AND_REUSABLE | onboardingFeed.js refuses Project COMPLETED mutation |

**Implication:** Completion foundations trustworthy; Wave 3 proves policy edges + WITH_GAPS honesty.

