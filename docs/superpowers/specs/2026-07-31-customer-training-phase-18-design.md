# Customer Training Phase 18 — Design (MISLABELLED / SUPERSEDED FOR PRD NUMBERING)

> **PRD correction:** Customer Training is **PRD Phase 22**. Tree phase-18 Training was mislabelled (PRD 18 = Demo Management).  
> **Authoritative design:** [`2026-07-31-customer-training-phase-22-design.md`](./2026-07-31-customer-training-phase-22-design.md)  
> This file is retained as historical alias. Do not start new Training work from this numbering.

**Status:** Approved historically (user review 2026-07-31); **superseded for PRD numbering by Phase 22 design**  
**Date:** 2026-07-31  
**Surface:** `/insightbooks/customer-success/training` (+ requests, programs, cohorts, sessions, participants, trainers, curricula, assessments, certificates, reports, settings; thin extensions on onboarding / conversion / CS customer deep-links)  
**Architecture:** Approach 1 — dual-entity `CustomerTrainingRequest` + `CustomerTrainingProgram` spine; reconcile Phase 8 `CsTrainingRecord`; consume Phase 16 Training handoffs + Phase 17 coordination  
**Upstream exit:** Phase 17 `READY_FOR_PHASE_18_WITH_BLOCKERS` (`docs/admin-intelligence-crm/phase-17/PHASE_18_INPUTS.md`)

---

## 1. Purpose

Deliver one authoritative, versioned, evidence-based Customer Training plane that consumes Phase 16 Training handoffs and Phase 17 Training coordination, and manages Requests through Programs, curricula, cohorts, sessions, attendance, assessments, completion, and checksummed certificates — then feeds authoritative Training outcomes back to onboarding — without fabricating Participants, attendance, results, completion, or certificates, and without becoming a disconnected public LMS.

---

## 2. Locked decisions

| Topic | Decision |
|-------|----------|
| Domain vs Phase 8 | **A** — new Request/Program spine; link/migrate `CsTrainingRecord` |
| Handoff → Request → Program | **A** — auto-create idempotent Request from Phase 16 TRAINING handoff (+ Phase 17 coordination); humans accept → Program |
| Sessions / virtual | **A** — hard-integrate Phase 13 Meetings; virtual provider typed `VIRTUAL_PROVIDER_NOT_CONFIGURED`; RSVP ≠ attendance |
| Assessments / certificates | **A** — knowledge-check + practical + completion/participation certificates with checksum; no full SCORM/question-bank LMS |
| Architecture | **Approach 1** — dual-entity Request + Program |
| Sequencing | **Approach B** waves + SDD |
| Exit | Expect **`READY_FOR_PHASE_19_WITH_BLOCKERS`** when virtual provider / recording / rich authoring / portal remain explicit |
| Commits | Only when user asks; WORKING_TREE OK; SQL + model guards if Prisma EPERM |

---

## 3. Hard rules

- Training Handoff ≠ Training Request ≠ Training Program ≠ Cohort ≠ Session.
- Attendance ≠ assessment pass ≠ Program completion ≠ onboarding completion ≠ Product adoption.
- Certificate ≠ professional accreditation / licensure / government accreditation.
- Invitation delivery / calendar acceptance / meeting-link access alone ≠ attendance.
- Phase 16 handoff + accepted commercial / entitlement scope are authoritative for Product/role Training scope.
- Exact retries must not duplicate Requests, Programs, curriculum materialisation, Sessions, attendance, attempts, or certificates.
- Assessment timing and attempt limits are server-authoritative; final results are immutable (regrade records only).
- Completion is deterministic against a versioned policy; UNKNOWN ≠ COMPLETED.
- Phase 17 receives typed Training-domain outcomes only; onboarding UI cannot fabricate Training completion; Training complete ≠ auto onboarding complete.
- No Production Customer data in shared practice environments; no credentials in materials/notes/exports.
- No AI-generated course content, questions, attendance, results, or certificates.
- Reliability / metric gate fail → never fabricated zero.
- System `/insightbooks/chart-of-accounts` stays removed; Tenant CoA remains functional.
- No Tenant GL / Subscription / entitlement mutations from Training.

---

## 4. Domain architecture

```text
Phase 16 CrmConversionDomainHandoff (TRAINING)
        ↓ (+ Phase 17 CustomerOnboardingTraining)
CustomerTrainingRequest  (TRQ-YYYY-######)
        ↓ accept + convert + curriculumVersionId
CustomerTrainingProgram  (TRN-YYYY-######)
        ├── CurriculumVersion + ModuleVersions (immutable once applied)
        ├── Cohorts → Participants / Enrolments
        ├── Trainers / Assignments (skills, availability, conflicts)
        ├── Sessions → Phase 13 CrmMeeting
        ├── Materials / Training Environment (isolation)
        ├── Attendance (source-backed) / Exercises
        ├── Assessments / Attempts / Results / Retakes / Regrades
        ├── ParticipantCompletion / ProgramCompletion
        ├── Certificate (checksum) + public-safe verification
        └── Typed outcome → Phase 17 trainingDomainSource / trainingDomainStatus
```

**Canonical services (illustrative):**
- `consumeTrainingHandoff({ actorContext, handoffId, idempotencyKey })` → Request
- `acceptTrainingRequest` / `rejectTrainingRequest`
- `createCustomerTrainingProgram({ actorContext, trainingRequestId, curriculumVersionId, ownerAssignments, targetStartDate, targetCompletionDate, idempotencyKey })`
- `scheduleTrainingSession` → Meeting link
- `captureTrainingAttendance` / `correctTrainingAttendance`
- `startAssessmentAttempt` / `submitAssessmentAttempt` / `gradeAssessmentAttempt`
- `evaluateParticipantCompletion` / `issueTrainingCertificate`
- `publishTrainingOutcomeToOnboarding({ programId, idempotencyKey })`

**Reuse:** Phase 16 Training handoff; Phase 17 `training.js` gate; Phase 8 foundations; Phase 13 Meetings/Calendar/Tasks/Email; Phase 9 Product/Module taxonomy for curriculum mapping; Phase 11 Contacts.

**Do not duplicate:** Platform Customer, Tenant, Business, Branch, Subscription, Entitlement, User, CRM Contact, Onboarding Project, Phase 13 Meeting rows as a second calendar, Support Tickets, Product catalogue.

**Phase 8 reconcile:** `CsTrainingRecord` gains Program link when resolvable; else UNKNOWN — never invent COMPLETED.

---

## 5. Request model

### Sources
`PHASE_16_TRAINING_HANDOFF`, `PHASE_17_ONBOARDING_REQUIREMENT`, `CUSTOMER_SUCCESS_REQUEST`, `SUPPORT_RECOMMENDATION`, `PRODUCT_ADOPTION_INTERVENTION`, `CUSTOMER_REQUEST`, `PLAN_UPGRADE`, `ADD_ON_ACTIVATION`, `NEW_USER_REQUEST`, `REFRESHER_REQUEST`, `MRA_EIS_REQUEST`, `MANUAL_APPROVED`, `LEGACY_MIGRATION`, `API`, `OTHER`.

### Pins
Request number `TRQ-YYYY-######`, source + reference, conversion/handoff/onboarding Project, Customer, Tenant, Subscription, training type, Product/plan/add-on scope, required roles/modules, expected Participant count, language, delivery mode, dates, owners, validation/duplicate state, status, idempotency, audit.

### Statuses
`NEW`, `VALIDATING`, `INFORMATION_REQUIRED`, `DUPLICATE_REVIEW_REQUIRED`, `READY`, `ACCEPTED`, `REJECTED`, `CONVERTED_TO_PROGRAM`, `CUSTOMER_DEFERRED`, `CANCELLED`, `SUPERSEDED`, `ARCHIVED`.

One conversion to Program (concurrency-safe). Exact handoff retry → same Request.

---

## 6. Program, types, curricula, modules

### Program
Number `TRN-YYYY-######`, type, Request, Customer, Tenant, Subscription, Onboarding Project, Products/plan/add-ons, roles, **curriculumVersionId**, owners, lead Trainer, Customer Training Contact, dates, delivery modes, language, Participant counts, status, health, progress, completion policy version, audit.

### Types (catalogue)
`CUSTOMER_ONBOARDING`, `TENANT_ADMINISTRATOR`, `BUSINESS_ADMINISTRATOR`, `BRANCH_ADMINISTRATOR`, `FINANCE_ACCOUNTING`, `INVENTORY`, `POINT_OF_SALE`, `SALES_CRM`, `HR_PAYROLL`, `PROJECT_MANAGEMENT`, `ASSET_MANAGEMENT`, `PROCUREMENT`, `REPORTING`, `MRA_EIS`, `TECHNICAL_INTEGRATION`, `REFRESHER`, `NEW_USER`, `TRAIN_THE_TRAINER`, `CUSTOMER_EXPANSION`, `PLAN_UPGRADE`, `ADD_ON`, `CUSTOM_APPROVED`.

### Program statuses (abbrev.)
`DRAFT` → requirements/curriculum/participant/trainer/scheduling → `READY_TO_START` → `IN_PROGRESS` → assessment/retake/completion review → `COMPLETED` / `COMPLETED_WITH_GAPS` (+ pause/risk/block/defer/cancel/fail/archive). Invalid jumps fail. No `DRAFT → COMPLETED`.

### Curricula / modules
Versioned; active versions immutable; applicability by type/product/plan/role/language; historical Programs retain exact versions. Role-to-module mapping must not assign unentitled Product modules.

### Program creation
Validates Request, handoff, Customer/Tenant/Subscription, scope, curriculum applicability, owners, duplicates. Pins curriculum/module versions. Exact retry returns existing Program.

---

## 7. Participants, trainers, cohorts, sessions

### Participants
Identity: verified Tenant User / Customer Contact / approved external. Verification states include `PENDING_VERIFICATION`, `UNKNOWN` (no restricted access). Enrolment statuses through completed/withdrawn/deferred/transferred.

### Trainers
Internal / specialist / assistant / approved external. Skills, languages, delivery modes, availability, capacity. Assignment validates competence + conflicts. Overlapping Sessions blocked without approved resolution.

### Cohorts
Numbered; language; delivery mode; timezone; capacity; status through completion.

### Sessions
Numbered; link Phase 13 Meeting; timezone explicit; status through delivered/completed/rescheduled/cancelled. Calendar Event alone ≠ delivery. Virtual provider unavailable → typed fail, not fabricated delivery.

### Conflicts
Trainer / Participant / venue / capacity / timezone / prerequisite / environment. States: `NO_CONFLICT`, `WARNING`, `APPROVAL_REQUIRED`, `BLOCKED`, `UNKNOWN` (≠ NO_CONFLICT).

---

## 8. Attendance, exercises, assessments, completion, certificates

### Attendance
States: `PRESENT`, `PRESENT_LATE`, `PRESENT_PARTIAL`, `LEFT_EARLY`, `EXCUSED_ABSENCE`, `UNEXCUSED_ABSENCE`, `NO_SHOW`, `MAKE_UP_REQUIRED`, `PENDING_VERIFICATION`, `UNKNOWN`.  
Sources: trainer confirmed, participant check-in, signed document, authorised correction (provider record when configured). Corrections preserve original. Invitation/calendar/link ≠ attendance.

### Exercises
Submit → review → pass / retry / waived. Source-backed evidence.

### Assessments
Types in foundation: knowledge-check, practical (+ role-based/MRA where templated). Server start/end, attempt limits, answer confidentiality, objective auto-grade + manual grade, immutable final result, retake, regrade with original preserved.

### Completion
Versioned policy: modules + attendance + exercises + assessments + waivers. Participant and Program completion states; `COMPLETED_WITH_GAPS` explicit. Publish to Phase 17 via typed service only.

### Certificates
Types: participation, completion, TTT, MRA EIS training, role-specific, custom approved. Number `IB-TRN-CERT-YYYY-######`, template version, artifact, checksum, verification code, revoke/reissue. Public-safe verify exposes limited fields only. Not accreditation.

### Feedback
Identified or anonymous with low-volume privacy threshold. No identity leak via narrow Branch filters.

---

## 9. Integrations

| Target | Behaviour |
|--------|-----------|
| Phase 17 onboarding | Typed outcome Event/service; readiness updates; no direct table forgery; no auto onboarding COMPLETED |
| Customer Success | Completion summary + gaps + refresher recommendations; no unsupported Health overwrite |
| Product Analytics | Association comparisons only; no causal claims |
| Support | Training-gap handoffs; no duplicate tickets |
| Phase 13 | Meetings/Calendar/Tasks/Email for Sessions and reminders |

---

## 10. Health, metrics, reliability

Deterministic Training health (versioned rules): `HEALTHY` … `UNKNOWN` / `NOT_ENOUGH_DATA`. Distinct from Customer Health and adoption.

Metrics: requests, programs, participants, sessions, attendance, assessments, completion, certificates, feedback — gate fail → unavailable, never false zero.

Reliability gate checks handoff/program/curriculum/participant/trainer/session/attendance/assessment/completion/certificate/recon/DQ/permission/freshness.

---

## 11. UI surfaces

Overview queues; My Work; Team; Calendar/Today/Upcoming; At-Risk; Completion; Request list/detail; Program list/detail tabs (curriculum, cohorts, participants, trainers, schedule, sessions, materials, environment, attendance, exercises, assessments, results, feedback, completion, certificates, risks, issues, documents, communications, reconciliation, timeline); catalogues; reports/DQ/recon/audit/settings.

---

## 12. Security, privacy, SoD

Permissions under `systemAdmin.customerSuccess.training*` (view/overview/myWork; requests; programs; curricula; modules; cohorts; participants(+sensitive); trainers; sessions; materials(+restricted); attendance(+correct/approve); exercises; assessments(+grade/regrade); completion; certificates(+issue/revoke); feedback; reports/export/schedule; dataQuality; reconciliation; audit).

Projections: Trainer assigned-only; CS portfolio summaries; MRA/Product specialists scoped; Executive aggregates; Auditor read-only.

SoD: curriculum/module/assessment author≠approver; attendance correction requester≠approver; grader≠protected regrade approver; completion evaluator≠protected approver; certificate issue≠revoke where required.

Cache keys include Customer/Tenant/curriculum/assessment versions/permission version/watermark. Never cache answers, meeting tokens, restricted materials, recordings, credentials in broad aggregates.

---

## 13. Wave plan (Approach B + SDD)

| Wave | Deliverables | Stop gate |
|------|--------------|-----------|
| **0** | Forensic audits under `docs/admin-intelligence-crm/phase-18/`; gap register; IMPLEMENTATION_PLAN | CONDITIONAL GO |
| **1** | Request/Program models + numbering + states + handoff consume + curriculum seed + idempotency + thin API/UI | Request/Program truth; no duplicate convert |
| **2** | Participants, trainers, cohorts, Sessions↔Phase 13, conflicts, attendance, materials/env boundary | No fabricated attendance/delivery; conflicts enforced |
| **3** | Exercises, assessments/attempts/grading/retake/regrade, completion, certificates, Phase 17 feed | No false complete/cert; immutable results |
| **4** | Overview/My Work/calendar/detail UI; metrics+reliability; DQ/recon; reports/exports; Phase 8 migrate; Phase 19 pack | Exit `READY_FOR_PHASE_19_WITH_BLOCKERS` |

No parallel implementers. Commits only on user request.

---

## 14. Out of scope (Phase 18)

- Full general-purpose LMS / SCORM / public marketplace / paid public courses
- Full video-streaming platform / rich content-authoring suite
- AI-generated content, questions, attendance, results, certificates
- Biometric / face-recognition attendance
- Automatic Training / onboarding / Health / Subscription / entitlement changes
- Virtual provider / recording production integration (typed unavailable)
- Tenant accounting postings; billing SoT changes; MRA fiscal submissions
- Phase 19 Adoption Operations (consumes Phase 18 outcomes)

---

## 15. Acceptance (phase exit)

Phase 18 exits **`READY_FOR_PHASE_19_WITH_BLOCKERS`** when:

- One canonical Request/Program domain exists; Phase 8 reconciled; Phase 16/17 sources consumed safely
- Request/Program creation idempotent; curricula/modules versioned
- Participants verified; Trainers conflict-checked; Sessions use Phase 13; attendance source-backed
- Assessments secure; results immutable; completion deterministic; certificates checksummed and verifiable
- Phase 17 receives authoritative outcomes; no fabricated Training complete from onboarding UI
- Reliability gate never invents zeroes; recon/DQ/lineage documented
- EN + Chichewa; mobile from 320px; no Critical/High defects in delivered waves
- Optional gaps (virtual provider, recording, rich banks, portal) remain **explicit**
- Phase 19 input package complete

---

## 16. Spec self-review notes

- No TBD for locked decisions.
- Distinctions Handoff/Request/Program/Session/Attendance/Completion/Certificate preserved.
- Virtual provider deferred with stable typed code.
- Wave 1 seeds minimal ACTIVE curriculum version so Program always pins `curriculumVersionId`.
- Exit WITH_BLOCKERS by design given deferred providers and foundation assessment depth.
