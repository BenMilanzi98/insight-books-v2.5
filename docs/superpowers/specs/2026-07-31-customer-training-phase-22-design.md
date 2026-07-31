# Customer Training Phase 22 — Design

**Status:** Approved (user review 2026-07-31)  
**Date:** 2026-07-31  
**Authoritative scope:** PRD Phase 22 — Customer Training Management  
**Surface:** `/insightbooks/customer-success/training` (+ overview, my-work, team, portfolio, calendar, queues, handoffs, programs, curricula, courses, modules, lessons, materials, cohorts, sessions, participants, trainers, attendance, assessments, results, completions, certificates, feedback, refresher, CS/product handoffs, reports, DQ, reconciliation, audit, settings; thin extensions on onboarding / CS customer / intelligence deep-links)  
**Architecture:** Approach 1 — extend existing `CustomerTraining*` + `lib/admin/customerSuccess/training/**` (tree phase-18); no parallel Training domain  
**Code alias:** Tree `docs/admin-intelligence-crm/phase-18/` Customer Training ≡ this PRD Phase 22  
**Docs home:** `docs/admin-intelligence-crm/phase-22/` (forensic + compatibility + Phase 23 pack)  
**Upstream exit:** Phase 21 `READY_FOR_PHASE_22_WITH_BLOCKERS` (`docs/admin-intelligence-crm/phase-21/PHASE_22_INPUTS.md`)

---

## 1. Purpose

Harden and ratify one authoritative, evidence-based Customer Training plane that consumes Phase 21 Training handoffs (checksum) and manages Requests through Programs, curricula, trainers, cohorts, enrolment, sessions, attendance, exercises, assessments, completion, certificates, feedback/quality, and Customer Success / Product Analytics / Support outcome handoffs — without fabricating delivery, confusing Training with Product adoption or Marketing attribution, posting unauthorised Tenant accounting, or creating a second disconnected Training domain.

---

## 2. Locked decisions

| Topic | Decision |
|-------|----------|
| Existing Training vs new domain | **A** — harden tree-18 `lib/admin/customerSuccess/training/**`; no second domain |
| Docs / quarantine | **A** — new `phase-22/` pack; FUTURE banners on tree-18 Training pack; preserve Demo (PRD 18), onboarding (PRD 21), Adoption folders; no deletes |
| Gap depth | **A** — full PRD §2 CURRENT_* forensic pack; Critical/High drive Waves 1–4; Medium/Low → WITH_BLOCKERS residuals |
| Program create sources | **A** — Phase 21 Training handoff primary; other catalogue sources allowed only through same identity/scope/DQ gates; retarget mislabelled `PHASE_16_*` / `PHASE_17_*` source codes to PRD-correct labels |
| Architecture | **Approach 1** — extend existing Request (`TRQ`) + Program (`TRN`) spine |
| Sequencing | **Approach B** waves + Subagent-Driven Development |
| Exit | Expect **`READY_FOR_PHASE_23_WITH_BLOCKERS`** when meeting-provider / recording / rich LMS authoring / learner portal / scheduled-report polish remain explicit typed blockers |
| Commits | Only when user asks; WORKING_TREE OK; SQL + model guards if Prisma EPERM |

---

## 3. Phase-label correction (authoritative)

| PRD phase | Authoritative content | Tree folder (current) | Action |
|-----------|----------------------|------------------------|--------|
| 18 | Demo Management | CRM Demo domain (not Training) | **Preserve — distinct** |
| 20 | Lead Conversion / Closed-Won | Tree phase-16 (+ phase-20 docs) | Consume commercial/identity context only |
| 21 | Customer Onboarding | Tree phase-17 (+ phase-21 docs) | Consume Training handoff emit; coordination only |
| **22** | **Customer Training** | Tree **phase-18** Training | **This phase — harden + re-home docs to phase-22/** |
| 23 | Marketing Attribution | — | Phase 23 pack target (identity/source/consent rules; Training ≠ acquisition) |
| FUTURE CS | Adoption / renewals | Tree phase-19 | Quarantine — do not redefine Training |

**Do not** delete working Training / onboarding / Adoption code. **Do not** convert Demo into Training. **Do not** reimplement onboarding.

Prior design (alias / mislabelled): `docs/superpowers/specs/2026-07-31-customer-training-phase-18-design.md` — superseded for PRD numbering by this document; code spine remains the same domain.

---

## 4. Hard rules

- Phase 21 Training Handoff ≠ Training Request ≠ Training Program ≠ Cohort ≠ Session.
- Invitation queued ≠ sent ≠ delivered ≠ registered ≠ attended.
- Meeting-link click / calendar accept ≠ attendance; attendance ≠ competency ≠ completion ≠ Product adoption ≠ retention ≠ Marketing acquisition.
- Certificate ≠ Product entitlement ≠ professional/government accreditation.
- Exact retries must not duplicate handoff acceptances, Requests, Programs, curriculum materialisation, enrolments, invitations, Calendar Events, Sessions, attendance, attempts, results, completions, certificates, or CS/PA handoffs.
- UNKNOWN validation/eligibility/completion ≠ VALID/ELIGIBLE/COMPLETED; gate fail → `UNAVAILABLE` / `value: null` (never false zero).
- No fabricated handoff accept, Program, Participant, invitation delivery, attendance, assessment result, competency, completion, certificate, feedback, or quality score.
- No AI-generated attendance / results / completion / certificates.
- No facial recognition / ungoverned biometric / hidden monitoring attendance.
- No uncontrolled Production Journals, opening balances, opening stock, billing source-of-truth changes, or MRA EIS fiscal submissions from Training exercises.
- System `/insightbooks/chart-of-accounts` stays removed; Tenant CoA remains functional.
- Portfolio / team / territory / customer / tenant / business / branch fail-closed on list/search/export/metrics/writes-by-id.
- Question-bank answers and assessment responses never in broad search, notifications, general exports, or pre-submit browser payloads.
- Training Participants must not automatically become Leads; Training attendance must not be acquisition attribution without explicit campaign evidence.

---

## 5. Domain architecture

```text
Phase 21 Training Handoff (checksum)
        ↓ validate / accept / reject / correct / supersede (idempotent)
CustomerTrainingRequest (TRQ-YYYY-######)
        ↓ accept + convert
CustomerTrainingProgram (TRN-YYYY-######)
        ├── Template version + Curriculum version (pinned, immutable when active)
        ├── Courses / Training modules / Lessons / Objectives / Materials
        ├── Trainers / Qualifications / Availability / Assignments (conflicts)
        ├── Cohorts (COH-) → Participants / Enrolments / Invitations / Waitlist
        ├── Sessions (SES- or existing TRS-) → Calendar / Meeting typed boundary
        ├── Attendance (evidence) / Corrections (append-only) / Exercises
        ├── Assessments / Question banks / Attempts / Results / Appeals / Retakes
        ├── Competencies / Participant–Course–Cohort–Program completion
        ├── Certificates (CERT- / existing IB-TRN-CERT-) checksum + verify/revoke
        ├── Feedback / Quality (versioned; ≠ Customer Health)
        ├── Refresher / Remedial requirements (evidence-triggered)
        ├── CS / Product Analytics / Support handoffs (source-labelled)
        └── DQ / Reconciliation / Lineage / Metrics / Reports / Exports
```

**Canonical path:** `lib/admin/customerSuccess/training/**`  
**Catalogue:** `phase: 22`, `treePhaseAlias: 18`

**Reuse:** Phase 21 `emitPhase22TrainingHandoff` / checksum; onboarding coordination; Phase 17 CRM Tasks/Meetings/Calendar; Platform Customer/Tenant/User/Contact; Product/module taxonomy; existing Request/Program/cohort/session/attendance/assessment/certificate modules.

**Do not duplicate:** Onboarding Projects; Demo Management; Adoption Plans; Support Tickets; Product-event warehouse; Customer Health engine; second Calendar/Meeting store; public open-registration LMS.

**Phase 8 reconcile:** `CsTrainingRecord` links when resolvable; else UNKNOWN — never invent COMPLETED.

---

## 6. Handoff validation & acceptance

Validate: handoff identity, onboarding Project, Customer, Tenant, Subscription, Products/plan/add-ons/modules/features/workflows, roles, Businesses/Branches, participant candidates/count, Training Contact, coordinator, language, delivery mode, target dates, go-live dependency, commercial inclusion, accessibility, watermark, checksum, DQ/recon, permission scope.

States include `VALID`, `VALID_WITH_WARNINGS`, `INFORMATION_REQUIRED`, `CORRECTION_REQUIRED`, `RECONCILIATION_FAILED`, `DATA_QUALITY_BLOCKED`, `DUPLICATE_HANDOFF`, `SUPERSEDED`, `REJECTED`, `BLOCKED`, `UNKNOWN`, … — **UNKNOWN never VALID**.

`acceptTrainingHandoff({ actorContext, handoffId, expectedVersion, acceptanceNotes, idempotencyKey })` — authorise, validate checksum + source Project + scope, no conflicting duplicate active Program purpose, record acceptance, emit events. Exact retry → same result.

Acceptance does **not** prove enrolment, invitation delivery, session schedule, attendance, assessment pass, completion, or certificate issuance.

Blocking Phase 21 handoff conditions (identity / checksum / scope / isolation unresolved) → do not begin full Program create waves until remediated or typed BLOCKED.

---

## 7. Request & Program spine

### Request
Sources (retargeted): `PHASE_21_TRAINING_HANDOFF` (primary), plus gated `CUSTOMER_SUCCESS_REQUEST`, `SUPPORT_RECOMMENDATION`, `REFRESHER_REQUEST`, `MRA_EIS_REQUEST`, `MANUAL_APPROVED`, `LEGACY_MIGRATION`, etc. Mislabelled legacy codes mapped → PRD-correct aliases in catalogue + migration notes.

Statuses through `ACCEPTED` / `CONVERTED_TO_PROGRAM` / reject / supersede / cancel. One conversion to Program (concurrency-safe). Exact handoff retry → same Request.

### Program
Number `TRN-YYYY-######` (immutable, concurrency-safe). Pins template + curriculum versions, owners, Customer/Tenant/scope, dates, delivery/language, completion-policy version. Status machine forbids DRAFT→COMPLETED, schedule-alone→COMPLETED, COMPLETED with required UNKNOWN Participants or missing required assessments. `COMPLETED_WITH_GAPS` explicit.

Types: ONBOARDING, ROLE_BASED, ADMINISTRATOR / FINANCE / ACCOUNTING / SALES / INVENTORY / … / MRA_EIS / REFRESHER / REMEDIAL / TRAIN_THE_TRAINER / EXECUTIVE_OVERVIEW / COMPLIANCE / CUSTOM_APPROVED (catalogue-aligned).

`createCustomerTrainingProgram({ actorContext, handoffId | trainingRequestId, programTemplateVersionId, curriculumVersionId, ownerAssignments, proposedSchedule, idempotencyKey })` — validate accepted handoff/Request, scope, versions, owners, duplicates; materialise required structure once; exact retry → existing Program.

---

## 8. Curriculum, materials, trainers, cohorts, enrolment

- **Templates / curricula / courses / Training modules / lessons / objectives:** versioned; ACTIVE immutable; Product modules ≠ Training modules (explicit refs); measurable objectives only.
- **Materials:** versioned + classification + private storage for restricted; reauthorise download; no answer keys to Participants.
- **Trainers:** qualification / availability / capacity / conflicts required before assignment (approved exception only).
- **Cohorts:** `COH-YYYY-######`; capacity; Customer/Tenant scope; no unsafe multi-Customer mix.
- **Participants:** authoritative User/Contact/approved candidate; dedupe; consent ≠ Marketing consent; PII projections.
- **Enrolment / invitation / registration / waitlist:** distinct states; SENT ≠ DELIVERED ≠ REGISTERED; idempotent invitations; capacity + prerequisite + entitlement validation.

---

## 9. Sessions, attendance, exercises, assessments, completion, certificates

### Sessions
Numbered; timezone; trainer/participant conflict detection; Calendar/Meeting via Phase 17 typed boundary; provider unavailable → typed `VIRTUAL_PROVIDER_NOT_CONFIGURED` (not fabricated delivery). Calendar accept ≠ attendance.

### Attendance
Evidence-backed statuses (`PRESENT`, `LATE`, `PARTIAL`, `NO_SHOW`, …, `UNKNOWN`). Corrections append-only with approval where configured. No invitation/email/link/login-only attendance. No biometric/facial recognition.

### Exercises
Sandbox / labelled demo / non-Production only. Never uncontrolled Production postings.

### Assessments
Versioned published assessments immutable. Question-bank security (server-side answers; no leak in logs/notifications/exports). Attempt tokens non-predictable; attempt/time limits server-enforced. Auto + manual grading; finalisation auditable; corrections preserve history; appeals with SoD where required; retakes keep prior attempts visible.

### Competency / completion
Attendance alone ≠ competency. Versioned completion policy for Participant / course / cohort / Program. `COMPLETED_WITH_GAPS` / waivers / exemptions explicit. UNKNOWN required records block unsupported COMPLETED.

### Certificates
Eligibility UNKNOWN ≠ issue. Numbering + non-predictable verification code + checksum; idempotent issue; revoke/supersede preserve history; public verify PII-safe. Not entitlement / accreditation.

### Feedback / quality
Versioned forms; anonymous privacy; deterministic quality rules; do not overwrite Customer Health; no causal adoption claims.

---

## 10. Outcome handoffs & Phase 23 prep

| Target | Behaviour |
|--------|-----------|
| Customer Success | Outcome package: coverage, gaps, retakes, refreshers, barriers; checksum/idempotent; no auto Healthy |
| Product Analytics | Source-labelled trained-user context; **no** Product-usage Events, first/repeat value, or causal adoption |
| Support / Product | Typed handoffs; do not merge into Tickets/defects as duplicates |
| Onboarding | Typed Training-domain outcome; coordination COMPLETED only from Training evidence; no auto onboarding COMPLETED |
| Phase 23 | Stable Customer/Tenant/Contact identities; Training event identities; source classification; marketing-consent + communication-eligibility boundaries; **Training ≠ acquisition attribution** without campaign evidence; Participants ≠ auto Leads |

Refresher/remedial requirements are evidence-triggered; no auto-enrol/contact unless approved policy.

---

## 11. Metrics, reliability, DQ, recon, UI

- Reliability gate before metrics and before attendance/result/completion/certificate decisions.
- Gate fail → never fabricated zero; progress ≠ quality ≠ completion ≠ adoption.
- DQ rules + reconciliation across handoff → Program → Participants → delivery → assessments → completion → certificates → outcome handoffs.
- Overview / My Work / portfolio / queues / Program detail / Session detail — thin harden + honesty labels; server-side pagination; mobile Cards; EN + Chichewa.
- Search/export/cache: scope + PII + answer-key safe; permissions revalidated at download.

---

## 12. Wave plan (SDD)

| Wave | Focus |
|------|--------|
| **0** | Forensic pack under `docs/admin-intelligence-crm/phase-22/`; mislabel audit; compatibility map; Phase 21 input validation; gap register; CONDITIONAL GO |
| **1** | Handoff validate/accept/correct/supersede + Request/Program spine + numbering + status machine + source retarget |
| **2** | Curriculum/materials/trainers/cohorts/participants/enrolment/invitation honesty |
| **3** | Sessions/attendance/exercises/assessments/results/completion/certificates + CS/PA handoff emit |
| **4** | UI/metrics/DQ/recon/search/exports + Phase 23 pack + exit `READY_FOR_PHASE_23_WITH_BLOCKERS` |

Per-task: TDD Vitest → implement → SDD review gate (Critical/Important fix before next). Final whole-branch review before exit ratification.

---

## 13. Testing (foundation)

Vitest waves covering: handoff checksum/accept/idempotency/correction; Program create/idempotency/status; curriculum version immutability; trainer conflicts; participant dedupe; invitation≠attendance; attendance evidence/corrections; assessment security/limits/grading/appeals; completion policy + COMPLETED_WITH_GAPS; certificate eligibility/idempotency/revoke; CS/PA handoff honesty; reliability gate null-on-fail; portfolio/tenant scope; accounting/MRA boundaries.

Critical E2E scenarios from PRD §73 (handoff→Program, correction, invitation≠attendance, partial attendance, retake, appeal, cert revoke, trained≠adopted, coverage gaps, cross-tenant, stale data, mobile) drive regression tests where implementable in-process.

---

## 14. Explicit non-goals (this phase)

Complete onboarding/adoption/product-analytics/health/support/marketing reimplementation; public open LMS; AI-generated Training truth; biometric attendance; automatic Subscription/entitlement/billing changes; Production accounting/MRA fiscal from Training; deleting mislabelled CS folders.

---

## 15. Exit criteria (summary)

One canonical Training domain; Phase 21 handoffs consumed safely; Program/attendance/assessment/completion/certificate foundations trustworthy; CS + PA handoffs source-labelled; recon/DQ honesty; Critical/High cleared or typed blockers; Phase 23 input package complete → **`READY_FOR_PHASE_23_WITH_BLOCKERS`** (or stricter remediation state if truth fails).

---

## 16. Spec self-review

| Check | Result |
|-------|--------|
| Placeholders | None intentional; optional integrations = typed blockers |
| Consistency | Approach 1 + waves match locked decisions |
| Scope | Harden existing domain; full forensic Wave 0; Critical/High implement |
| Ambiguity | Session number prefix: prefer existing `TRS-` / catalogue; align to PRD `SES-` only via compatibility alias if dual codes exist — Wave 0 documents actual code |
| Commits | User-ask only (overrides brainstorming auto-commit) |
