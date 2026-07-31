# Current Onboarding Completion Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Onboarding completion evaluation | NOT_FOUND | Spec `evaluateOnboardingCompletion` absent |
| Onboarding CompletionCertificate | NOT_FOUND | — |
| Conversion completion certificate | WRONG_DOMAIN / CORRECT_AND_REUSABLE pattern | `CrmConversionCompletionCertificate` + `finalizeConversion` — ≠ onboarding complete; reuse checksum/idempotency patterns |
| Progress % = completion | FORBIDDEN | Foundations keep `progressPercent: null` |
| Go-live = completion | FORBIDDEN | Design: go-live → stabilisation → handover → completion |
| Exact retry same certificate | NOT_FOUND | Wave 3 contract |
| Fabricated complete from handoff | FORBIDDEN | `onboardingCompleted: false` forced on emit |

**Implication:** Wave 3 issue checksummed onboarding certificate; never equate conversion finalize or progress % to onboarding complete.
