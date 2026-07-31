# Task 0 P18 review package
File count: 50


===== README.md =====

# Phase 18 — Customer Training

**Surface:** `/insightbooks/customer-success/training` (+ requests, programs, cohorts, sessions, participants, trainers, curricula, assessments, certificates, reports, settings; thin deep-links from onboarding / conversion / CS customer)

**Architecture:** Approach 1 — dual-entity `CustomerTrainingRequest` (`TRQ-`) + `CustomerTrainingProgram` (`TRN-`) under `lib/admin/customerSuccess/training/*`; reconcile Phase 8 `CsTrainingRecord`; consume Phase 16 Training handoffs + Phase 17 training coordination

**Design:** `docs/superpowers/specs/2026-07-31-customer-training-phase-18-design.md`

**Plan:** `docs/superpowers/plans/2026-07-31-customer-training-phase-18.md`

**Handoff in:** `docs/admin-intelligence-crm/phase-17/PHASE_18_INPUTS.md`

**Phase 17 exit:** `READY_FOR_PHASE_18_WITH_BLOCKERS`

**Wave 0 decision:** **CONDITIONAL GO** for Wave 1 — see `FINAL_READINESS_DECISION.md`

**Execution mode:** Subagent-Driven (chosen). Wave 1 may proceed after controller review of this pack.

## Wave status

| Wave | Focus | Status |
|------|-------|--------|
| 0 | Forensic audits + matrices + readiness | Complete (2026-07-31) |
| 1 | Request/Program spine + numbering + curricula seed + handoff consume + idempotency | Not started |
| 2 | Participants/trainers/cohorts + Sessions (Phase 13) + conflicts + attendance + materials/env | Not started |
| 3 | Exercises/assessments/completion/certificates + Phase 17 feed | Not started |
| 4 | UI hubs + metrics/reliability + DQ/recon + reports/exports + Phase 8 migrate + Phase 19 pack | Not started |

## Hard rules

- Training Handoff ≠ Training Request ≠ Training Program ≠ Cohort ≠ Session
- Attendance ≠ assessment pass ≠ Program completion ≠ onboarding completion ≠ Product adoption
- Certificate ≠ professional accreditation / licensure
- Invitation / calendar acceptance / meeting-link access alone ≠ attendance
- Phase 16 handoff + accepted commercial / entitlement scope are authoritative for Product/role Training scope
- Exact retries must not duplicate Requests, Programs, curriculum materialisation, Sessions, attendance, attempts, or certificates
- Assessment timing and attempt limits are server-authoritative; final results immutable (regrade records only)
- Completion is deterministic against a versioned policy; UNKNOWN ≠ COMPLETED
- Phase 17 receives typed Training-domain outcomes only; onboarding UI cannot fabricate Training completion; Training complete ≠ auto onboarding complete
- No Production Customer data in shared practice environments; no credentials in materials/notes/exports
- No AI-generated course content, questions, attendance, results, or certificates
- Reliability / metric gate fail → never fabricated zero
- Virtual provider = `VIRTUAL_PROVIDER_NOT_CONFIGURED` until configured
- System `/insightbooks/chart-of-accounts` stays removed; no Tenant GL / Subscription / entitlement mutations from Training
- Expected phase exit (Wave 4): **READY_FOR_PHASE_19_WITH_BLOCKERS**

## Classification legend

| Class | Meaning |
|-------|---------|
| CORRECT_AND_REUSABLE | Keep as boundary / input; do not redefine |
| REUSE_WITH_RECONCILIATION | Reuse only with explicit mapping / honesty |
| EXTEND | Reuse and extend under Training domain |
| STANDARDISE | Align shapes/contracts across planes |
| CONSOLIDATE | Merge duplicated paths into one canonical |
| REFACTOR | Restructure without changing honesty contract |
| REIMPLEMENT | Replace unsafe/wrong implementation |
| DUPLICATED | Parallel truth exists — resolve |
| DISCONNECTED | Exists but not wired to canonical spine |
| WRONG_DOMAIN | Exists but belongs to another plane |
| WRONG_SOURCE | Wrong authoritative source |
| WRONG_SCOPE | Scope filter incorrect / too broad |
| CLIENT_SIDE_ONLY | UI-only; not server truth |
| NON_IDEMPOTENT | Exists but lacks Training-grade idempotency |
| UNVERSIONED | Missing version / checksum / immutability |
| UNRECONCILED | Missing recon to parent truth |
| ATTENDANCE_TRUTH_RISK | Risk of false attendance from invite/RSVP/link |
| ASSESSMENT_TRUTH_RISK | Risk of false pass / leaked answers / client timer |
| COMPLETION_TRUTH_RISK | Risk of false Program/Participant completion |
| CERTIFICATE_TRUTH_RISK | Risk of cert without completion / forged verify |
| TRAINING_TRUTH_RISK | Risk of readiness ≠ training complete |
| CUSTOMER_ACTION_TRUTH_RISK | Risk of fabricating Customer action |
| CROSS_TENANT_RISK | Scope / isolation gap |
| CROSS_BUSINESS_RISK | Business isolation gap |
| CROSS_BRANCH_RISK | Branch isolation gap |
| CUSTOMER_PORTFOLIO_RISK | CS portfolio scope gap |
| CONTACT_PRIVACY_RISK | Contact PII exposure risk |
| FILE_SECURITY_RISK | Materials/env file security gap |
| PERFORMANCE_RISK | Scale / N+1 / cache risk |
| REMOVE_AFTER_MIGRATION | Legacy after Program link |
| BLOCKED | Cannot proceed until dependency cleared |
| NOT_APPLICABLE | Out of Training plane |
| NOT_FOUND | Absent in codebase / schema |
| NOT_AVAILABLE | Explicitly deferred with typed contract |
| FORBIDDEN | Must not be used / invented for this phase |

## Pack index

- Scope / validation: `PHASE_18_SCOPE.md`, `PHASE_INPUT_VALIDATION.md`
- CURRENT_* domain audits + `TRAINING_*` DQ/privacy/security/performance/recon
- Matrices: `TRAINING_*_MATRIX.md`
- Gaps / plan / readiness: `PHASE_18_GAP_REGISTER.md`, `IMPLEMENTATION_PLAN.md`, `FINAL_READINESS_DECISION.md`
- Full phase exit report deferred to Wave 4 (`FINAL_PHASE_18_REPORT.md` / `PHASE_19_INPUTS.md`)


===== PHASE_INPUT_VALIDATION.md =====

# Phase 18 Input Validation

**Validated:** 2026-07-31  
**Upstream exit:** `READY_FOR_PHASE_18_WITH_BLOCKERS` (Phase 17 `FINAL_READINESS_DECISION.md` / `FINAL_PHASE_17_REPORT.md`)

## Sources checked

| Source | Path | Result |
|--------|------|--------|
| Phase 18 inputs | `docs/admin-intelligence-crm/phase-17/PHASE_18_INPUTS.md` | PRESENT — training coordination COMPLETED requires Phase 18 domain source; honesty gates listed |
| Readiness checklist | `docs/admin-intelligence-crm/phase-17/PHASE_18_READINESS_CHECKLIST.md` | PRESENT — onboarding plane must-be-true checked; Training engine listed as Phase 18 ownership |
| Final Phase 17 decision | `docs/admin-intelligence-crm/phase-17/FINAL_READINESS_DECISION.md` | PRESENT — exit `READY_FOR_PHASE_18_WITH_BLOCKERS` |
| Phase 17 training coordination | `lib/admin/customerSuccess/onboarding/training.js` | PRESENT — COMPLETED requires Phase 18 Training-domain source |
| Phase 16 TRAINING handoff | `lib/admin/crm/conversions/trainingHandoff.js` | PRESENT — forces `trainingCompleted: false` |
| Phase 8 training audit | `docs/admin-intelligence-crm/phase-08/CURRENT_TRAINING_AUDIT.md` | PRESENT — NOT_INSTRUMENTED foundations |
| Design | `docs/superpowers/specs/2026-07-31-customer-training-phase-18-design.md` | APPROVED 2026-07-31 — Approach 1 + Approach B |
| Plan | `docs/superpowers/plans/2026-07-31-customer-training-phase-18.md` | PRESENT — Task 0 = this pack |

## Phase 17 must-be-true (consumed honestly)

| Gate | Evidence class |
|------|----------------|
| CustomerOnboardingRequest / Project spine | CORRECT_AND_REUSABLE — `lib/admin/customerSuccess/onboarding/*` |
| Phase 16 ONBOARDING handoff consume | CORRECT_AND_REUSABLE — `handoffConsume.js`; handoff ≠ execute |
| Training coordination COMPLETED gate | CORRECT_AND_REUSABLE — `onboarding/training.js` requires `trainingDomainSource` ∈ {PHASE_18_TRAINING, PHASE_18, TRAINING_DOMAIN, CUSTOMER_TRAINING} + `trainingDomainStatus=COMPLETED` |
| Readiness training dimension | CORRECT_AND_REUSABLE — `readiness/evaluate.js` `evaluateTrainingDim` — COMPLETED without Phase 18 source → NOT_READY |
| Kick-off ↔ Phase 13 Meeting pattern | CORRECT_AND_REUSABLE — RSVP ≠ attendance; fail closed if Meeting unavailable |
| Reliability gate never invents zeroes | CORRECT_AND_REUSABLE — onboarding metrics pattern for Wave 4 Training |
| Phase 8 CsOnboardingRecord link or UNKNOWN | CORRECT_AND_REUSABLE pattern — mirror for `CsTrainingRecord` in Wave 4 |
| No Tenant GL from onboarding | CORRECT_AND_REUSABLE — Training must preserve same boundary |
| Customer portal typed unavailable | CORRECT_AND_REUSABLE carry — `CUSTOMER_PORTAL_NOT_CONFIGURED` |

## Phase 18 reuse plane (pre-Wave-1)

| Asset | Path | Class for Training |
|-------|------|----------------------|
| Phase 16 TRAINING handoff | `lib/admin/crm/conversions/trainingHandoff.js` | CORRECT_AND_REUSABLE — seed Request; never invent complete |
| Domain handoff shared | `lib/admin/crm/conversions/handoffShared.js` | CORRECT_AND_REUSABLE — type TRAINING; `recordOnly: true`, `executesDomainWork: false` |
| `CrmConversionDomainHandoff` model | `prisma/schema.prisma` + Phase 16 SQL | CORRECT_AND_REUSABLE |
| Phase 17 training coordination | `lib/admin/customerSuccess/onboarding/training.js` | CORRECT_AND_REUSABLE consumer/feed target |
| `CustomerOnboardingTraining` model | `prisma/schema.prisma` (~15335) + `scripts/sql/cs-onboarding-phase17-wave3.sql` | CORRECT_AND_REUSABLE feed target |
| Phase 8 CsTrainingRecord | `prisma/schema.prisma` (~11277) + `scripts/sql/customer-success-phase08.sql` | REUSE_WITH_RECONCILIATION — empty → NOT_INSTRUMENTED; link in Wave 4 |
| CS foundations UI/API | `app/insightbooks/customer-success/training/page.js`, `app/api/admin/customer-success/foundations/route.js`, `foundations.js` | EXTEND / DISCONNECTED — foundations view only; not Request/Program spine |
| Route permission | `lib/admin/permissions.js` → `customerSuccess.read` | EXTEND — no `training*` SoD perms yet |
| Phase 13 Meetings | `lib/admin/crm/meetings/*` | CORRECT_AND_REUSABLE — Session Meeting; RSVP ≠ attendance |
| Phase 9 Product/Module taxonomy | Product catalogue | CORRECT_AND_REUSABLE for curriculum/role-module mapping |
| Phase 11 Contacts | CRM Contact plane | CORRECT_AND_REUSABLE for Participant identity |
| Conversion / onboarding reliability/DQ/export patterns | conversions + onboarding metrics/exports | CORRECT_AND_REUSABLE patterns for Wave 4 |
| CS expansion handoffs | `lib/admin/customerSuccess/handoffs.js` | WRONG_DOMAIN for Closed-Won Training Request seed |
| CS tasks / Support tickets | `tasks.js`, Support plane | WRONG_DOMAIN — ≠ Training Participants/attendance |
| Onboarding completion certificate | `onboarding/completion.js` | WRONG_DOMAIN — ≠ Training certificate |
| `resolveCrmScope` | `lib/admin/crm/authz.js` | CROSS_TENANT_RISK — stub `mode: 'all'` |
| `CustomerTrainingRequest` / Program | — | NOT_FOUND |
| `lib/admin/customerSuccess/training/**` | — | NOT_FOUND |
| `app/api/admin/customer-success/training-requests/**` / `training-programs/**` | — | NOT_FOUND |
| Training curricula / modules / cohorts / sessions | — | NOT_FOUND |
| Training attendance / assessments / certificates | — | NOT_FOUND |
| `consumeTrainingHandoff` / `publishTrainingOutcomeToOnboarding` | — | NOT_FOUND |

## Identity / handoff blockers?

**None** that block Wave 1 Request/Program spine + handoff consume + accept/convert + curriculum pin + idempotency. Phase 16 TRAINING handoff exists, is distinct from ONBOARDING/MIGRATION/MRA_EIS, pins conversion/tenant in payload, and forces `trainingCompleted: false` / `executesTraining: false`. Phase 17 coordination COMPLETED gate already requires Phase 18 domain source. Customer/Tenant/Subscription pins come from conversion / onboarding Project. Full Participants/Sessions/attendance/assessments/certs remain Waves 2–3; virtual provider remains typed NOT_AVAILABLE.

## Validation verdict

**PASS** — Phase 17 exit is honest (`READY_FOR_PHASE_18_WITH_BLOCKERS`); design/plan locked; reuse plane identified (TRAINING handoff + Phase 17 coordination gate + Meetings + Phase 8 foundations CORRECT_AND_REUSABLE / REUSE_WITH_RECONCILIATION; Request/Program spine NOT_FOUND greenfield). Proceed to Wave 0 readiness decision (**CONDITIONAL GO**).


===== FINAL_READINESS_DECISION.md =====

# Final Readiness Decision — Wave 0 Interim (Phase 18)

**Decision:** **CONDITIONAL GO**

**Date:** 2026-07-31  
**Scope of this decision:** Wave 0 forensic pack complete → Wave 1 application code may proceed after controller review.  
**Not yet:** Phase exit `READY_FOR_PHASE_19_WITH_BLOCKERS` (Wave 4).

## Rationale

1. **Upstream exit validated:** Phase 17 `READY_FOR_PHASE_18_WITH_BLOCKERS` with honest blockers (portal, migration engine, MRA fiscal, payment/e-sign, Training execution ownership → Phase 18).
2. **PHASE_INPUT_VALIDATION = PASS:** Phase 16 TRAINING handoff (`trainingHandoff.js`) forces `trainingCompleted: false` / `executesTraining: false`; Phase 17 `onboarding/training.js` COMPLETED gate requires Phase 18 domain source; readiness `evaluateTrainingDim` refuses READY from forged COMPLETED.
3. **Reuse plane clear:** Handoffs, Meetings, Product taxonomy, Contacts, foundations, coordination feed target = CORRECT_AND_REUSABLE / REUSE_WITH_RECONCILIATION. Request/Program/curricula/sessions/attendance/assessments/certs = **NOT_FOUND** (expected greenfield).
4. **Design + plan locked:** Approach 1 dual-entity + Approach B waves; Global Constraints match hard rules; execution mode **Subagent-Driven**.
5. **Gap register maps cleanly** to Waves 1–4; no identity/handoff TBD blocks Wave 1 spine.
6. **Honesty carry:** Virtual provider `VIRTUAL_PROVIDER_NOT_CONFIGURED`; gate fail → never false zero; certificate ≠ accreditation; Training complete ≠ onboarding complete; no Tenant GL / entitlement mutations.

## Conditions for Wave 1

1. Implement Request/Program spine + `consumeTrainingHandoff` + curriculum pin + idempotency only — no Session/attendance fabrication.
2. Acknowledge handoff typed IN_PROGRESS at most — never set `trainingCompleted` / onboarding coordination COMPLETED from Wave 1 alone.
3. Preserve Cross-Tenant fail-closed patterns; add `training*` permission skeleton; SQL + `hasCustomerTraining*Model` guards for Prisma EPERM.
4. Do not treat `CsTrainingRecord` or foundations UI as Program truth.
5. Stop for SDD review before Wave 2.

## Wave / pack completion

- [x] Phase input validation PASS (Wave 0)
- [x] CURRENT_* + TRAINING_* audits + matrices
- [x] Gap register + IMPLEMENTATION_PLAN Waves 1–4
- [ ] Wave 1 application code
- [ ] Wave 2 application code
- [ ] Wave 3 application code
- [ ] Wave 4 application code + Phase 19 pack
- [x] **CONDITIONAL GO** recorded (Wave 0 interim)

**Next:** Controller review → Subagent-Driven Task 1 (Wave 1).  

**Stop:** No Wave 1 code in this pack. Do not fabricate Training complete from onboarding coordination; do not invent KPI zeroes; do not invent Program COMPLETED from Phase 8 historical rows; do not post Tenant GL from Training.


===== PHASE_18_GAP_REGISTER.md =====

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


===== IMPLEMENTATION_PLAN.md =====

# Phase 18 Implementation Plan (pointer)

**Authoritative plan:** [`docs/superpowers/plans/2026-07-31-customer-training-phase-18.md`](../../superpowers/plans/2026-07-31-customer-training-phase-18.md)

**Design:** [`docs/superpowers/specs/2026-07-31-customer-training-phase-18-design.md`](../../superpowers/specs/2026-07-31-customer-training-phase-18-design.md)

| Wave | Deliverable | Gap IDs |
|------|-------------|---------|
| 0 | This forensic pack (done 2026-07-31) | — |
| 1 | Request + Program spine + numbering + state machines + handoff consume + accept/reject/convert + idempotency + seeded ACTIVE curriculum/module versions + role-module entitlement bound + permissions skeleton + thin API/UI stubs | G18-01…10, G18-39, G18-41 |
| 2 | Participants/enrolment + trainers + cohorts + Sessions↔Phase 13 + conflicts + attendance + materials/env isolation + virtual typed unavailable | G18-11…19 |
| 3 | Exercises + assessments/attempts/grading/retake/regrade + completion policy + certificates + Phase 17 typed feed + health/progress | G18-20…26 |
| 4 | UI hubs + metrics/reliability + DQ/recon/lineage + reports/exports/search/cache + Phase 8 migrate + i18n + Phase 19 pack + FINAL reports | G18-27…33 |

**Expected phase exit (Wave 4):** `READY_FOR_PHASE_19_WITH_BLOCKERS`  
(Virtual provider, recording, rich LMS authoring, portal, payment/e-sign, scope harden may remain deferred)

**Execution:** Subagent-Driven already chosen. Wave 1 may proceed after controller review of Wave 0 **CONDITIONAL GO**. **No application code in Wave 0.**  
**Skip:** `PHASE_19_INPUTS.md` / full `FINAL_PHASE_18_REPORT.md` until Wave 4 (this file's `FINAL_READINESS_DECISION.md` is Wave 0 interim only).


===== CURRENT_TRAINING_ARCHITECTURE_AUDIT.md =====

# Current Training Architecture Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Dual-entity Request/Program spine | NOT_FOUND | No `CustomerTrainingRequest` / `CustomerTrainingProgram` in `prisma/schema.prisma`; no `lib/admin/customerSuccess/training/**` |
| Phase 16 TRAINING handoff emit | CORRECT_AND_REUSABLE | `lib/admin/crm/conversions/trainingHandoff.js` → `createDomainHandoff` type `TRAINING`; forces `trainingCompleted: false` |
| Handoff ≠ execute | CORRECT_AND_REUSABLE | `handoffShared.js` `serializeDomainHandoff` → `recordOnly: true`, `executesDomainWork: false`; executionStatus defaults NOT_STARTED |
| Phase 17 training coordination gate | CORRECT_AND_REUSABLE | `lib/admin/customerSuccess/onboarding/training.js` — COMPLETED requires Phase 18 domain source |
| Phase 8 checklist foundation | REUSE_WITH_RECONCILIATION | `CsTrainingRecord` + `foundations.js` `getFoundationStatus` kind=training; empty → `NOT_INSTRUMENTED`; `progressPercent: null` |
| CS training UI | DISCONNECTED / CLIENT_SIDE_ONLY foundations | `app/insightbooks/customer-success/training/page.js` renders `CustomerSuccessFoundationsView kind="training"` only |
| Foundations API | EXTEND | `app/api/admin/customer-success/foundations/route.js` |
| Route permission | EXTEND | `lib/admin/permissions.js` maps `/insightbooks/customer-success/training` → `customerSuccess.read` — no `training*` SoD perms yet |
| CS expansion handoff | WRONG_DOMAIN | `lib/admin/customerSuccess/handoffs.js` — expansion record-only ≠ Closed-Won TRAINING handoff |
| Onboarding Project as Training Program | WRONG_DOMAIN | `CustomerOnboardingProject` is onboarding spine — not Training Program |
| Fabricated training complete | FORBIDDEN | Handoff payload forces `trainingCompleted: false`; coordination rejects COMPLETED without domain source |

**Implication:** Wave 1 greenfield Request/Program under `lib/admin/customerSuccess/training/*`; consume Phase 16 TRAINING handoff; feed Phase 17 via typed service later; reconcile Phase 8 in Wave 4. Do not treat foundations UI or expansion handoffs as the Training spine.

