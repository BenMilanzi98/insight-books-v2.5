# Training Compatibility Map — PRD 22 Customer Training

**Audited:** 2026-07-31  
**Legend:** READY | PARTIAL | GAP | CORRECT_AND_REUSABLE | EXTEND | FOUNDATION | MISLABELLED_PHASE | FUTURE_PHASE_SCOPE | NOT_FOUND | FORBIDDEN

## Domain surfaces

| Surface | Path(s) | Status | Class | Notes |
|---------|---------|--------|-------|-------|
| Domain contract / catalogue | `catalogue.js` (`phase: 18`) | PARTIAL | EXTEND / MISLABELLED_PHASE | Honesty flags good; bump `phase: 22`, `treePhaseAlias: 18` |
| Phase 16 TRAINING handoff consume | `handoffConsume.js` `consumeTrainingHandoff` | READY | CORRECT_AND_REUSABLE / EXTEND | Idempotent TRQ; never fabricates complete |
| Phase 21 Phase22 handoff emit | `onboarding/training.js` `emitPhase22TrainingHandoff` + checksum | READY | CORRECT_AND_REUSABLE | CreatesPrograms=false |
| Phase 21 Phase22 handoff accept/consume | — | GAP | NOT_FOUND | **Critical Wave 1** — no checksum validate/accept into TRQ/Program |
| Request spine | `requests.js`, Prisma `CustomerTrainingRequest` | READY | CORRECT_AND_REUSABLE / EXTEND | TRQ- + status machine; sources need retarget |
| Program spine | `programs.js`, Prisma `CustomerTrainingProgram` | READY | CORRECT_AND_REUSABLE / EXTEND | TRN- + curriculum pin + idempotency |
| Status machines | `status.js` | PARTIAL | EXTEND | Invalid transitions; deepen DRAFT→COMPLETED forbid |
| Curriculum seed | `curricula.js` `ensureWave1OnboardingCurriculumVersion` | PARTIAL | EXTEND | ACTIVE pin exists; course/lesson thin |
| Modules | Prisma `CustomerTrainingModule*` | PARTIAL | EXTEND | Models present; rich course/lesson NOT_FOUND |
| Materials | `materials.js` | PARTIAL | EXTEND | Classification; private download deepen |
| Trainers / conflicts | `trainers.js`, `conflicts.js` | PARTIAL | EXTEND | Competence + conflict checks |
| Cohorts | `cohorts.js` | PARTIAL | EXTEND | COH- + capacity |
| Participants | `participants.js` | PARTIAL | EXTEND | Verify/dedupe; UNKNOWN blocks |
| Enrolment | `enrolment.js` | PARTIAL | EXTEND | Capacity/duplicate; invitation distinct states GAP |
| Invitation lifecycle | — | GAP | NOT_FOUND | SENT≠DELIVERED≠REGISTERED≠attended |
| Sessions | `sessions.js` | PARTIAL | EXTEND | **TRS-** prefix (not SES-); Meeting fail-closed |
| Calendar UI | `app/.../training/calendar/page.js` | PARTIAL | FOUNDATION | Thin hub; calendar accept ≠ attendance |
| Attendance | `attendance.js` | READY | CORRECT_AND_REUSABLE / EXTEND | Forbidden invite/RSVP/link sources |
| Exercises | `exercises.js` + `environment.js` | PARTIAL | EXTEND | No Production data |
| Assessments / attempts / grading | `assessments.js`, `attempts.js`, `grading.js` | PARTIAL | EXTEND | Server limits; question-bank first-class GAP |
| Results | assessment result models + grading | PARTIAL | EXTEND | Final immutable + regrade |
| Competency | — | GAP | NOT_FOUND | Attendance alone ≠ competency |
| Completion | `completion.js` | PARTIAL | EXTEND | Policy v1; UNKNOWN≠COMPLETED; WITH_GAPS |
| Certificates | `certificates.js` | PARTIAL | EXTEND | Checksum + idempotent; ≠ accreditation |
| Feedback / quality | — | GAP | NOT_FOUND | Wave 3 |
| Refresher / remedial | catalogue type REFRESHER only | GAP | PARTIAL / NOT_FOUND engine | Evidence-triggered requirements missing |
| CS outcome handoff | — | GAP | NOT_FOUND | Wave 3 — no auto Healthy |
| PA outcome handoff | — | GAP | NOT_FOUND | Wave 3 — no Product Events |
| Onboarding feed | `onboardingFeed.js` | PARTIAL | EXTEND / MISLABELLED_PHASE | Uses `PHASE_18_TRAINING`; no auto Project COMPLETED |
| Metrics / reliability | `metrics.js`, `reliabilityGate.js` | PARTIAL | EXTEND | Gate fail → null |
| DQ / recon / lineage | `dataQuality.js`, `reconciliation.js`, `lineage.js` | PARTIAL | EXTEND | lineageIntact not invented true |
| Reports / exports / search | `reports.js`, `exports.js`, `search.js` | PARTIAL | EXTEND | Strip answers/tokens |
| UI hubs | `app/insightbooks/customer-success/training/**` | PARTIAL | FOUNDATION | Present; polish Wave 4 |
| APIs | training-requests/programs/sessions routes | PARTIAL | FOUNDATION | Thin |
| Demo domain | `lib/admin/crm/demos/**` | N/A | WRONG_DOMAIN | Preserve PRD 18 |
| Adoption | `lib/admin/customerSuccess/adoption/**` | N/A | FUTURE_PHASE_SCOPE | Quarantine |
| Fabricate COMPLETED/attendance/certs | — | — | FORBIDDEN | Never |

## Compatibility rollup

| Upstream / peer | Class for PRD 22 |
|-----------------|------------------|
| Phase 21 Phase22 Training handoff emit + checksum | CORRECT_AND_REUSABLE |
| Tree phase-18 Training spine + Vitest Waves 1–4 | CORRECT_AND_REUSABLE / EXTEND |
| Phase 16 TRAINING handoff consume | CORRECT_AND_REUSABLE (secondary) |
| Demo Management | WRONG_DOMAIN — preserve |
| Onboarding Project / completion / go-live | WRONG_DOMAIN — consume handoff only |
| Adoption | FUTURE_PHASE_SCOPE |
| Parallel second Training domain | FORBIDDEN |

## Implication

Wave 0 finds a **real, durable Training spine** already implemented under the tree-18 name. Phase 22 is **harden + Phase 21 handoff primary consume + honesty gaps + docs re-home**, not greenfield. Critical/High gaps cluster around Phase 21 handoff accept, invitation honesty, competency/feedback/quality/refresher, CS/PA handoffs, and PRD label retarget.

