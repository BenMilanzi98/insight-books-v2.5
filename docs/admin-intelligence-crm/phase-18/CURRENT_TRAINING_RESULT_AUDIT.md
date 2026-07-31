# Current Training Result Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Immutable final results + regrade records | NOT_FOUND | No Result/Regrade models |
| Objective auto-grade + manual grade | NOT_FOUND | Wave 3 grading services |
| Retake flow | NOT_FOUND | Must preserve prior attempt history |
| Onboarding test plan results as Training results | WRONG_DOMAIN | `CustomerOnboardingTestPlan.resultsJson` ≠ Training assessment results |

**Implication:** Wave 3 finalise immutable; regrade preserves original; ASSESSMENT_TRUTH_RISK if mutable in place.
