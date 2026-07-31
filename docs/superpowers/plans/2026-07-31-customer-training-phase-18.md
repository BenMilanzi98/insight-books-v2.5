# Customer Training Phase 18 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/insightbooks/customer-success/training` with one canonical Request/Program Training spine that consumes Phase 16 Training handoffs and Phase 17 coordination, delivers versioned curricula, Sessions via Phase 13, source-backed attendance, knowledge-check/practical assessments, checksummed certificates, and authoritative completion feed into onboarding — without fabricating attendance, results, completion, or certificates.

**Architecture:** Approach B waves. Approach 1 dual-entity `CustomerTrainingRequest` + `CustomerTrainingProgram` under `lib/admin/customerSuccess/training/**`. Phase 8 `CsTrainingRecord` reconciled by link/migrate. Virtual provider / recording / rich LMS authoring remain typed unavailable. Wave 0 docs-only stop gate before Wave 1 code.

**Tech Stack:** Next.js App Router, Prisma (+ SQL fallbacks), Vitest, AdminShell, Phase 16 Training handoffs, Phase 17 onboarding `training.js` gate, Phase 13 Meetings/Calendar, Phase 8 CS foundations, Phase 9 Product taxonomy, en/ny i18n.

**Spec:** [docs/superpowers/specs/2026-07-31-customer-training-phase-18-design.md](../specs/2026-07-31-customer-training-phase-18-design.md)

## Global Constraints

- Handoff ≠ Request ≠ Program ≠ Cohort ≠ Session; Attendance ≠ pass ≠ Program complete ≠ onboarding complete ≠ adoption; Certificate ≠ accreditation.
- Invitation / calendar accept / meeting-link alone ≠ attendance.
- Exact retry → existing Request/Program/Session/attendance/attempt/certificate; conflicting idempotency → fail visibly.
- Assessment timing/attempt limits server-authoritative; final results immutable (regrade records only).
- Completion deterministic against versioned policy; UNKNOWN ≠ COMPLETED.
- Phase 17 feed typed only (`trainingDomainSource=PHASE_18_TRAINING`); onboarding UI cannot fabricate Training complete; Training complete ≠ auto onboarding COMPLETED.
- Virtual provider = `VIRTUAL_PROVIDER_NOT_CONFIGURED`; no Production data in shared practice envs; no credentials in materials/notes/exports.
- No AI content/grades/attendance/certs; no Tenant GL / Subscription / entitlement mutations; gate fail → never false zero; System CoA stays removed.
- Commits only when user asks; WORKING_TREE OK; SQL + `hasCustomerTraining*Model` guards if Prisma EPERM.

## File map

| Area | Paths |
|------|--------|
| Training domain | `lib/admin/customerSuccess/training/**` (catalogue, numbering, requests, programs, status, curricula, modules, materialise, participants, trainers, cohorts, sessions, conflicts, attendance, exercises, assessments, grading, completion, certificates, onboardingFeed, health, progress, metrics, reliabilityGate, dq, recon, reports, permissions, search, cache) |
| Phase 17 feed | `lib/admin/customerSuccess/onboarding/training.js` (consume typed outcome; no fabricate) |
| Phase 8 reconcile | `lib/admin/customerSuccess/foundations.js`, `CsTrainingRecord` link |
| Prisma / SQL | `prisma/schema.prisma` + `scripts/sql/cs-training-phase18-wave{1,2,3,4}.sql` |
| APIs | `app/api/admin/customer-success/training-requests/**`, `training/**`, `training-programs/**` |
| UI | `app/insightbooks/customer-success/training/**`; extend onboarding/conversion deep-links |
| Integrations | Phase 16 `trainingHandoff.js`; Phase 13 `lib/admin/crm/meetings/*` |
| Tests | `test/systemAdmin.cs.trainingWave{1..4}.test.js` |
| Wave 0 / exit docs | `docs/admin-intelligence-crm/phase-18/*` |

---

### Task 0: Wave 0 — Forensic audits + matrices + readiness

**Files:** Create `docs/admin-intelligence-crm/phase-18/` audit pack per master prompt §5 (CURRENT_* training audits, DQ/privacy/security/performance, gap register, IMPLEMENTATION_PLAN, PHASE_INPUT_VALIDATION). No application code.

**Interfaces:**
- Consumes: Phase 17 `PHASE_18_INPUTS.md`, `PHASE_18_READINESS_CHECKLIST.md`, design locks, Phase 16 `TRAINING_HANDOFF`, Phase 8 `CsTrainingRecord`, Phase 17 `training.js`
- Produces: CONDITIONAL GO / BLOCKED in `docs/admin-intelligence-crm/phase-18/FINAL_READINESS_DECISION.md` (Wave 0 interim; full final report in Wave 4)

- [ ] Validate Phase 17 exit `READY_FOR_PHASE_18_WITH_BLOCKERS` (handoff ≠ execute; COMPLETED gate requires Phase 18 domain source)
- [ ] Audit routes, handoffs, Requests/Programs/curricula/modules/cohorts/participants/trainers/sessions/venues/virtual/materials/env/attendance/exercises/assessments/results/completion/certificates/feedback/reports/exports/permissions — classify with prompt taxonomy
- [ ] Write CURRENT_* + TRAINING_* audits with real file paths (not empty)
- [ ] Matrices: source, domain, type, curriculum, module, role-module, participant, trainer, scheduling, attendance, assessment, completion, certificate, reliability, security
- [ ] `PHASE_18_GAP_REGISTER.md` + `IMPLEMENTATION_PLAN.md` (gaps → Waves 1–4) + Wave 0 readiness decision
- [ ] Stop — **no Wave 1 code** until user chooses Subagent-Driven or Inline after CONDITIONAL GO

---

### Task 1: Wave 1 — Request + Program spine, numbering, curricula seed, handoff consume, idempotency

**Files:**
- Create: `lib/admin/customerSuccess/training/` — `catalogue.js`, `numbering.js`, `model.js`, `requests.js`, `programs.js`, `status.js`, `handoffConsume.js`, `curricula.js`, `index.js`
- Create: `scripts/sql/cs-training-phase18-wave1.sql` + Prisma: Request/RequestStatusHistory/Program/ProgramStatusHistory/Curriculum/CurriculumVersion/Module/ModuleVersion (+ seed ACTIVE onboarding curriculum)
- Thin APIs/UI under `app/api/admin/customer-success/training-requests/**`, `training-programs/**`, `app/insightbooks/customer-success/training/**`
- Wire: Phase 16 TRAINING handoff → `consumeTrainingHandoff`; optional Phase 17 coordination link
- Test: `test/systemAdmin.cs.trainingWave1.test.js`

**Interfaces:**
- Produces:
  - `consumeTrainingHandoff({ actorContext, handoffId, idempotencyKey })` → Request `TRQ-`
  - `validateTrainingRequest` / `acceptTrainingRequest` / `rejectTrainingRequest`
  - `createCustomerTrainingProgram({ actorContext, trainingRequestId, curriculumVersionId, ownerAssignments, targetStartDate, targetCompletionDate, idempotencyKey })` → Program `TRN-` with pinned curriculumVersionId
  - `ensureWave1OnboardingCurriculumVersion` — ACTIVE seed
  - Status transition helpers; invalid throws
  - Exact retry same key → same row; conflict → fail; one Request → one Program
  - Handoff acknowledge typed IN_PROGRESS only — never fabricate trainingCompleted

- [ ] **Step 1: Write failing Vitest** — handoff→TRQ; retry same; accept→TRN once; project retry same; conflict fails; invalid transition throws; missing Customer/Tenant/Subscription fails; curriculum pin required
- [ ] **Step 2: Run** `npx vitest run test/systemAdmin.cs.trainingWave1.test.js` — expect FAIL
- [ ] **Step 3: Implement** SQL/Prisma + lib + thin API/UI + model guards
- [ ] **Step 4: Re-run Vitest** — PASS; no Session/attendance yet; no Tenant GL
- [ ] SDD review gate before Wave 2

---

### Task 2: Wave 2 — Participants, trainers, cohorts, Sessions (Phase 13), conflicts, attendance, materials/env boundary

**Files:**
- Create: `participants.js`, `enrolment.js`, `trainers.js`, `cohorts.js`, `sessions.js`, `conflicts.js`, `attendance.js`, `materials.js`, `environment.js`
- Create: `scripts/sql/cs-training-phase18-wave2.sql` + Prisma models as needed
- Wire: `lib/admin/crm/meetings` for Session Meeting create/link; RSVP ≠ attendance
- Test: `test/systemAdmin.cs.trainingWave2.test.js`

**Interfaces:**
- Produces:
  - Participant verify/enrol; duplicate identity blocked; UNKNOWN blocked from restricted materials
  - Trainer assign with skill/language/conflict checks
  - Cohort create with capacity
  - `scheduleTrainingSession({ programId, cohortId, meetingInput, idempotencyKey })` → `crmMeetingId`; Meeting unavailable → `MEETING_SERVICE_UNAVAILABLE`
  - Conflict evaluation; BLOCKED/UNKNOWN ≠ confirmable as NO_CONFLICT
  - `captureTrainingAttendance` / `correctTrainingAttendance` (preserve original); invitation/calendar/link sources rejected
  - Materials classification + private download boundary; environment isolation assert (no Production data)
  - Virtual provider path returns `VIRTUAL_PROVIDER_NOT_CONFIGURED`

- [ ] **Step 1: Write failing Vitest** — Meeting once on retry; RSVP≠attendance; trainer overlap blocks confirm; attendance rejects invitation source; correction preserves original; UNKNOWN participant denied restricted material; env isolation assert; virtual provider typed unavailable
- [ ] **Step 2: Run Vitest** — expect FAIL
- [ ] **Step 3: Implement** lib + SQL + thin UI tabs
- [ ] **Step 4: Re-run Wave 1+2** — PASS
- [ ] SDD review gate before Wave 3

---

### Task 3: Wave 3 — Exercises, assessments, completion, certificates, Phase 17 feed

**Files:**
- Create: `exercises.js`, `assessments.js`, `attempts.js`, `grading.js`, `completion.js`, `certificates.js`, `onboardingFeed.js`, `health.js`, `progress.js`
- Create: `scripts/sql/cs-training-phase18-wave3.sql` + Prisma for Assessment/Version/Attempt/Result/Regrade/Completion/Certificate
- Modify: Phase 17 `training.js` / readiness only via `publishTrainingOutcomeToOnboarding` (typed); do not allow onboarding set-training-status to forge COMPLETED without domain source (already gated — ensure feed writes correct source)
- Test: `test/systemAdmin.cs.trainingWave3.test.js`

**Interfaces:**
- Produces:
  - Exercise submit/review/pass/retry/waiver
  - `startAssessmentAttempt` / `submitAssessmentAttempt` — server timer + attempt limit; answers not leaked in list payloads
  - Objective grade + manual grade; finalise immutable; retake; regrade preserves original
  - `evaluateParticipantCompletion` / Program completion against policy version
  - `issueTrainingCertificate({ participantCompletionId, templateVersionId, idempotencyKey })` — checksum; exact retry same cert; revoke → verification REVOKED
  - `publishTrainingOutcomeToOnboarding` — sets Phase 17 coordination `trainingDomainSource`/`trainingDomainStatus`; does not mark onboarding Project COMPLETED
  - Onboarding manual COMPLETED without domain source still fails

- [ ] **Step 1: Write failing Vitest** — attempt beyond limit fails; client-only timer not authoritative; final result immutable without regrade; completion blocked without attendance; cert without completion fails; cert retry same checksum; revoke verifies REVOKED; onboarding feed updates readiness dim; onboarding cannot fabricate COMPLETED; Cross-Tenant program access denied
- [ ] **Step 2: Run Vitest** — expect FAIL
- [ ] **Step 3: Implement** + thin UI tabs
- [ ] **Step 4: Re-run Wave 1+2+3** — PASS
- [ ] SDD review gate before Wave 4

---

### Task 4: Wave 4 — UI hubs, metrics/reliability, DQ/recon, Phase 8 migrate, Phase 19 pack

**Files:**
- Create/extend: Overview, My Work, Team, Calendar/Today/Upcoming, At-Risk, Completion workspace, Context Bar, Request/Program lists/details
- Create: `metrics.js`, `reliabilityGate.js`, `dataQuality.js`, `reconciliation.js`, `lineage.js`, `reports.js`, `exports.js`, `search.js`, `cache.js`, `notifications.js`
- Create: `scripts/sql/cs-training-phase18-wave4.sql` as needed
- Modify: `foundations.js` — Project/Program projection when linked; broken link → UNKNOWN not legacy COMPLETED
- Docs: full phase-18 pack including `PHASE_19_INPUTS.md`, `PHASE_19_READINESS_CHECKLIST.md`, `FINAL_PHASE_18_REPORT.md`, update `FINAL_READINESS_DECISION.md` → **`READY_FOR_PHASE_19_WITH_BLOCKERS`**
- i18n: en + ny training hub keys
- Test: `test/systemAdmin.cs.trainingWave4.test.js`

**Interfaces:**
- Produces:
  - Overview cards via reliability gate — fail → `UNAVAILABLE` / `value: null`
  - My Work scoped counts; list authz + portfolio fail-closed (mirror Phase 17 listScope pattern)
  - Report subset + CSV/XLSX with PII projection; answers/tokens excluded
  - Search for TRQ/TRN/cert numbers — no answers/tokens/restricted materials
  - Phase 8 migrate link; exit readiness documented

- [ ] **Step 1: Write failing Vitest** — gate fail not zero; portfolio list deny; search fail-closed without scope; export strips answers; foundations broken link ≠ COMPLETED; certificate still idempotent; EN key smoke
- [ ] **Step 2: Run Vitest** — expect FAIL
- [ ] **Step 3: Implement** UI + metrics + docs + migrate
- [ ] **Step 4: Re-run Wave 1–4 regression** — PASS; set exit state
- [ ] SDD final review

---

## Spec coverage self-review

| Spec section | Task |
|--------------|------|
| §2–3 Locked / hard rules | Global Constraints + all waves |
| §4 Dual-entity architecture | Task 1 |
| §5 Request | Task 1 |
| §6 Program/curricula/modules | Task 1 |
| §7 Participants/trainers/cohorts/sessions | Task 2 |
| §8 Attendance/assessments/completion/certs | Task 2–3 |
| §9 Integrations | Task 3–4 |
| §10 Health/metrics/reliability | Task 3–4 |
| §11–12 UI/security | Task 4 (+ thin earlier) |
| §13 Waves | Tasks 0–4 |
| §14 Out of scope | Typed gaps |
| §15 Exit WITH_BLOCKERS | Task 4 |

**Placeholder scan:** none intentional. Wave 1 seeds ACTIVE curriculum version for Program pin.

**Type consistency:** Request `TRQ-`, Program `TRN-`, Certificate `IB-TRN-CERT-`; services named as in Interfaces throughout.

---

## Execution handoff

Plan complete. After Wave 0 CONDITIONAL GO, choose:

1. **Subagent-Driven (recommended)** — fresh subagent per task + review between tasks  
2. **Inline Execution** — execute in this session with checkpoints  

Do not start Wave 1 code until Wave 0 stop gate clears and execution mode is chosen.
