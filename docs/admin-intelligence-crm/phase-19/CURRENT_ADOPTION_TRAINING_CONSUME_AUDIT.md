# Current Adoption ← Training Consume Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Training domain tree | CORRECT_AND_REUSABLE | `lib/admin/customerSuccess/training/**` (42 files) |
| Program completion evaluator | CORRECT_AND_REUSABLE | `completion.js` `evaluateProgramCompletion` — emits `COMPLETED` / `COMPLETED_WITH_GAPS` / other |
| Participant vs Program aggregate | CORRECT_AND_REUSABLE | Partial participant completion does not force Program `COMPLETED` |
| Certificates | CORRECT_AND_REUSABLE | `certificates.js` — issue/revoke/verify; ≠ accreditation |
| Onboarding feed | CORRECT_AND_REUSABLE | `onboardingFeed.js` — typed domain status; never flips Project to COMPLETED |
| Health / progress | CORRECT_AND_REUSABLE | `health.js`, `progress.js` — progress % ≠ Program COMPLETED |
| Metrics / reliability | CORRECT_AND_REUSABLE | `metrics.js`, `reliabilityGate.js` — gate fail → UNAVAILABLE / null |
| Reports / exports / search | CORRECT_AND_REUSABLE | `reports.js`, `exports.js`, `search.js` — answers/tokens stripped |
| DQ / recon / lineage | CORRECT_AND_REUSABLE | `dataQuality.js`, `reconciliation.js`, `lineage.js` |
| Handoff consume (Phase 16) | CORRECT_AND_REUSABLE | `handoffConsume.js` — Training spine seed; ≠ Adoption Request |
| Phase 8 migrate (training) | CORRECT_AND_REUSABLE pattern | `phase8Migrate.js` — link or UNKNOWN |
| `consumeTrainingCompletionForAdoption` | NOT_FOUND | Wave 1 greenfield |
| Auto Request on `COMPLETED_WITH_GAPS` | FORBIDDEN | Design lock — must reject / no-create |
| Training COMPLETED invents Adoption Plan COMPLETED | FORBIDDEN | Request seed only; Plan completion is Wave 2 policy |

**Implication:** Wave 1 `consumeTrainingCompletionForAdoption` reads Program aggregate via `evaluateProgramCompletion` (or durable Program status); creates ADR only when status is `COMPLETED`; exact retry same key → same Request; `COMPLETED_WITH_GAPS` / `IN_PROGRESS` → no Request.
