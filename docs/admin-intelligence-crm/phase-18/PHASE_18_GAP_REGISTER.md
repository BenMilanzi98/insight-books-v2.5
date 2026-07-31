# Phase 18 Gap Register

**Audited:** 2026-07-31  
**Inputs:** Phase 17 `PHASE_18_INPUTS.md`, Wave 0 audits, design/plan

| ID | Gap | Severity | Wave | Notes |
|----|-----|----------|------|-------|
| G18-01 | No CustomerTrainingRequest / TRQ numbering | BLOCKER | 1 | Greenfield under `lib/admin/customerSuccess/training/*` |
| G18-02 | No consumeTrainingHandoff from Phase 16 TRAINING | BLOCKER | 1 | CORRECT_AND_REUSABLE emit in `trainingHandoff.js` |
| G18-03 | No accept/reject/validate Request + status history | BLOCKER | 1 | Server-authorised transitions |
| G18-04 | No CustomerTrainingProgram / TRN numbering | BLOCKER | 1 | One Request → one Program |
| G18-05 | No createCustomerTrainingProgram + idempotency/conflict fail | BLOCKER | 1 | Exact retry |
| G18-06 | No seeded ACTIVE onboarding CurriculumVersion for Program pin | BLOCKER | 1 | `ensureWave1OnboardingCurriculumVersion` |
| G18-07 | No Request/Program status machines (invalid transition reject) | BLOCKER | 1 | No DRAFT→COMPLETED skip |
| G18-08 | Permissions skeleton `training*` | HIGH | 1 | Today only `customerSuccess.read` on foundations route |
| G18-09 | Thin API/UI stubs for requests/programs | HIGH | 1 stubs → 4 | Foundations page DISCONNECTED |
| G18-10 | ModuleVersion + role-module entitlement bound | BLOCKER | 1 | Never silent Product escalation |
| G18-11 | Participant verify/enrol + duplicate block | BLOCKER | 2 | UNKNOWN blocks restricted |
| G18-12 | Trainer assign + skills/capacity | BLOCKER | 2 | — |
| G18-13 | Cohort create with capacity | BLOCKER | 2 | — |
| G18-14 | Session ↔ Phase 13 Meeting; fail closed | BLOCKER | 2 | `MEETING_SERVICE_UNAVAILABLE` |
| G18-15 | Conflict evaluation; UNKNOWN ≠ NO_CONFLICT | BLOCKER | 2 | — |
| G18-16 | Attendance capture/correct; reject invite/RSVP/link | BLOCKER | 2 | ATTENDANCE_TRUTH_RISK |
| G18-17 | Materials classification + private download | HIGH | 2 | FILE_SECURITY_RISK |
| G18-18 | Practice env isolation (no Production data) | BLOCKER | 2 | FORBIDDEN Production copy |
| G18-19 | Virtual provider typed unavailable | HIGH | 2 | `VIRTUAL_PROVIDER_NOT_CONFIGURED` |
| G18-20 | Practical exercises submit/review/pass/retry/waiver | HIGH | 3 | CUSTOMER_ACTION_TRUTH_RISK |
| G18-21 | Assessments/attempts/server timer/limits | BLOCKER | 3 | ASSESSMENT_TRUTH_RISK |
| G18-22 | Grading + immutable final + retake/regrade | BLOCKER | 3 | — |
| G18-23 | Participant/Program completion policy version | BLOCKER | 3 | COMPLETION_TRUTH_RISK; UNKNOWN≠COMPLETED |
| G18-24 | Certificates checksum + verify + revoke/reissue | BLOCKER | 3 | CERTIFICATE_TRUTH_RISK; ≠ accreditation |
| G18-25 | publishTrainingOutcomeToOnboarding typed feed | BLOCKER | 3 | Must not auto-complete onboarding Project |
| G18-26 | Health/progress server calcs (no ML) | HIGH | 3 | Distinct from Customer Health |
| G18-27 | UI hubs Overview/My Work/Calendar/queues/detail tabs | MEDIUM | 1–4 | Thin early OK |
| G18-28 | Metrics + reliability gate (never false zero) | HIGH | 4 | Pattern from onboarding/conversion |
| G18-29 | DQ / recon / lineage | HIGH | 4 | — |
| G18-30 | Reports + exports + search/cache (strip answers/tokens) | HIGH | 4 | — |
| G18-31 | Phase 8 CsTrainingRecord → trainingProgramId migrate | HIGH | 4 | REUSE_WITH_RECONCILIATION; UNKNOWN if unresolved |
| G18-32 | EN + NY i18n for training surfaces | MEDIUM | 4 | — |
| G18-33 | Phase 19 input pack + FINAL_PHASE_18_REPORT | HIGH | 4 | Exit READY_FOR_PHASE_19_WITH_BLOCKERS |
| G18-34 | Virtual provider / recording | CARRY | — | VIRTUAL_PROVIDER_NOT_CONFIGURED |
| G18-35 | Rich SCORM / question-bank LMS | CARRY | — | NOT_AVAILABLE |
| G18-36 | Customer portal | CARRY | — | CUSTOMER_PORTAL_NOT_CONFIGURED |
| G18-37 | Migration engine / MRA fiscal / payment/e-sign | CARRY | — | Orthogonal NOT_AVAILABLE / NOT_CONFIGURED |
| G18-38 | resolveCrmScope stub mode:all | CARRY | Harden | CROSS_TENANT_RISK |
| G18-39 | Prisma EPERM Windows | CARRY | All | SQL + hasCustomerTraining*Model guards |
| G18-40 | AI content/grades/attendance/certs; fabricate complete | FORBIDDEN | — | Never |
| G18-41 | CS expansion / CsTask / Support / onboarding cert as Training truth | PROCESS | All | WRONG_DOMAIN guards |
| G18-42 | Telephony / calendar sync / Lead ingest / Demo cloud | CARRY | Orthogonal | NOT_AVAILABLE / NOT_CONNECTED |

**No TBD blocking Wave 1 after CONDITIONAL GO** — Phase 16 TRAINING handoff and Phase 17 COMPLETED gate are CORRECT_AND_REUSABLE; Customer/Tenant/Subscription pins available from conversion/onboarding; Request/Program spine expected NOT_FOUND greenfield; Meetings CORRECT_AND_REUSABLE for Wave 2; Phase 8 foundations REUSE_WITH_RECONCILIATION for Wave 4; virtual provider explicitly NOT_AVAILABLE.
