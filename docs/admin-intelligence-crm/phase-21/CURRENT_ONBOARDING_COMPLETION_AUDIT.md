# Current Onboarding Completion Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Completion + certificate models | CORRECT_AND_REUSABLE | CustomerOnboardingCompletion, CustomerOnboardingCompletionCertificate |
| Service | PARTIAL | completion.js — checksum + idempotency |
| Requires go-live + stabilisation + handover + recon | PARTIAL | Context load — prove COMPLETED_WITH_GAPS |
| Go-live ≠ completion | CORRECT_AND_REUSABLE | Hard rule |
| Progress % ≠ completion | CORRECT_AND_REUSABLE | progress.js / catalogue |

**Gaps:** G21-18…G21-19 → Wave 3.
