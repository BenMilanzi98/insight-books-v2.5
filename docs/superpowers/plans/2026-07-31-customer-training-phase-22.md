# Customer Training Phase 22 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ratify PRD Phase 22 Customer Training by forensically mapping mislabelled tree phase-18 Training, preserving Demo (PRD 18) and onboarding (PRD 21), and hardening the existing `CustomerTraining*` spine so Phase 21 Training handoff consumption, Program creation, attendance/assessment/completion/certificate honesty, and CS/Product Analytics handoffs are trustworthy — without a second Training domain or Marketing/adoption fabrication.

**Architecture:** Approach B waves. Approach 1 — extend `lib/admin/customerSuccess/training/**` (tree phase-18 ≡ PRD 22). New docs under `docs/admin-intelligence-crm/phase-22/`. Demo remains distinct CRM domain. Onboarding remains handoff producer only. Exit target `READY_FOR_PHASE_23_WITH_BLOCKERS`.

**Tech Stack:** Next.js App Router, Prisma (+ SQL fallbacks), Vitest, AdminShell, Phase 21 Training handoff emit/checksum, Phase 17 CRM Tasks/Meetings/Calendar, Platform Customer/Tenant/User/Contact, Product/module taxonomy, en/ny i18n.

**Spec:** [docs/superpowers/specs/2026-07-31-customer-training-phase-22-design.md](../specs/2026-07-31-customer-training-phase-22-design.md)  
**Prior design (mislabelled alias):** [docs/superpowers/specs/2026-07-31-customer-training-phase-18-design.md](../specs/2026-07-31-customer-training-phase-18-design.md)

## Global Constraints

- PRD Phase 22 = Customer Training; tree phase-18 Training code is canonical; do not create a parallel Training domain.
- PRD Phase 18 = Demo Management — preserve; do not convert Demo into Training.
- Do not delete onboarding (tree-17 / PRD 21) or Adoption (tree-19); quarantine Adoption as FUTURE; Phase 22 does not reimplement onboarding.
- Handoff ≠ Request ≠ Program ≠ Cohort ≠ Session; invitation ≠ registration ≠ attendance; attendance ≠ competency ≠ completion ≠ adoption ≠ Marketing acquisition.
- Exact retries must not duplicate handoff accept, Request, Program, curriculum materialisation, enrolments, invitations, Calendar Events, Sessions, attendance, attempts, results, completions, certificates, or CS/PA handoffs.
- UNKNOWN ≠ VALID/ELIGIBLE/COMPLETED; no fabricated delivery/attendance/results/completion/certs; gate fail → never false zero.
- No Tenant GL / billing SoT / MRA fiscal from Training; no secrets/answer keys in notes/exports/search/notifications; System CoA stays removed.
- Portfolio/team/territory/customer/tenant/business/branch fail-closed on list/search/export/metrics/writes-by-id.
- Commits only when user asks; WORKING_TREE OK; SQL + model guards if Prisma EPERM.
- Targeted harden Critical/High; meeting-provider / recording / rich LMS / learner portal / scheduled-report polish remain WITH_BLOCKERS when typed.

## File map

| Area | Paths |
|------|--------|
| Training domain (harden) | `lib/admin/customerSuccess/training/**` |
| Phase 21 handoff emit | `lib/admin/customerSuccess/onboarding/training.js` |
| Demo (preserve) | CRM Demo domain — do not absorb |
| Onboarding (do not reimplement) | `lib/admin/customerSuccess/onboarding/**` |
| Adoption (quarantine) | `lib/admin/customerSuccess/adoption/**` |
| Prisma | Existing `CustomerTraining*` — extend only if gap requires |
| APIs / UI | `app/api/admin/customer-success/training*/**`, `app/insightbooks/customer-success/training/**` |
| Tests | `test/systemAdmin.cs.trainingPhase22Wave{1..4}.test.js` (+ keep/extend tree `trainingWave*` where present) |
| Wave 0 / exit docs | `docs/admin-intelligence-crm/phase-22/*` |
| SDD ledger | `.superpowers/sdd/progress-phase22.md` (`*-p22.md`) |

---

### Task 0: Wave 0 — Forensic audits, compatibility map, CONDITIONAL GO

**Files:** Create Wave 0 pack under `docs/admin-intelligence-crm/phase-22/` per master prompt §2 (README, PHASE_22_SCOPE, AUTHORITATIVE_ROADMAP_MAP, MISLABELLED_TRAINING_ARTIFACT_AUDIT, TRAINING_COMPATIBILITY_MAP, PHASE_INPUT_VALIDATION, CURRENT_* audits for architecture/handoff/program/curriculum/course-module-lesson/material/trainer/cohort/participant/enrolment/session/calendar/invitation/attendance/exercise/assessment/question-bank/result/competency/completion/certificate/feedback/quality/refresher/CS-handoff/PA-handoff/report/export, DQ/recon/privacy/security/performance, GAP_REGISTER, IMPLEMENTATION_PLAN). Banner tree-18 Training pack FUTURE/mislabel. **No application code** except optional catalogue banner comments / README pointers.

**Interfaces:**
- Consumes: Phase 21 `PHASE_22_INPUTS.md`, `FINAL_READINESS_DECISION.md`, tree phase-18 Training docs/code, Demo domain, onboarding Training handoff emit, Adoption quarantine notes
- Produces: CONDITIONAL GO / BLOCKED; compatibility classifications; Critical/High gap list → Waves 1–4

- [ ] Validate Phase 21 exit READY_FOR_PHASE_22_WITH_BLOCKERS; map tree-18 Training ≡ PRD 22 with real paths
- [ ] Audit mislabelled Training under phase-18; Demo preserved; onboarding/Adoption FUTURE/quarantine correct
- [ ] Classify Training surfaces with real file paths; gap register → Waves 1–4
- [ ] Wave 0 readiness CONDITIONAL GO or BLOCKED
- [ ] Stop for SDD review gate; proceed Wave 1 after Approved

---

### Task 1: Wave 1 — Handoff validate/accept + Request/Program spine harden

**Files:** Harden `handoffConsume.js`, `requests.js`, `programs.js`, `status.js`, `numbering.js`, `catalogue.js` (phase: 22, treePhaseAlias: 18, source retarget); test `test/systemAdmin.cs.trainingPhase22Wave1.test.js`

**Interfaces / hardens:**
- Phase 21 handoff checksum validation; UNKNOWN ≠ VALID
- `acceptTrainingHandoff` (or equivalent consume/accept) idempotent; exact retry same
- Correction/supersession preserves history
- Request create/idempotent; Program create after accept; TRN- numbering; template/curriculum pin; duplicate active Program purpose blocked; conflicting idempotency fails
- Source codes retargeted (`PHASE_21_TRAINING_HANDOFF` primary; legacy PHASE_16/17 aliases mapped)
- Invalid status transitions throw

- [ ] Write failing Vitest → implement → PASS Wave 1
- [ ] SDD review gate before Wave 2

---

### Task 2: Wave 2 — Curriculum / trainers / cohorts / participants / enrolment honesty

**Files:** Harden `curricula.js`, `materials.js`, `trainers.js`, `cohorts.js`, `participants.js`, `enrolment.js`, conflict helpers; test Wave 2

**Interfaces / hardens:**
- Active curriculum/template versions immutable once applied to Program
- Product modules ≠ Training modules (explicit refs)
- Trainer assignment requires qualification + conflict check (approved exception only)
- Participant identity dedupe; Customer/Tenant/Business/Branch scope
- Enrolment idempotent; capacity/prerequisite gates
- Invitation SENT ≠ DELIVERED ≠ REGISTERED; never invent delivery
- Restricted materials / answer keys never in Participant projections

- [ ] Write failing Vitest → implement → PASS Waves 1–2
- [ ] SDD review gate before Wave 3

---

### Task 3: Wave 3 — Sessions / attendance / assessments / completion / certificates / outcome handoffs

**Files:** Harden `sessions.js`, `attendance.js`, `exercises.js`, `assessments.js`, `attempts.js`, `grading.js`, `completion.js`, `certificates.js`, environment boundary, CS/PA handoff emit modules; test Wave 3

**Interfaces / hardens:**
- Calendar/Meeting typed boundary; provider missing → typed NOT_CONFIGURED; schedule ≠ delivered
- Invitation/calendar/link ≠ attendance; attendance evidence required; corrections append-only
- Exercises: no Production GL/journals/stock/MRA fiscal
- Assessment versions immutable when published; attempt/time limits server-side; answer-key protection
- Completion policy versioned; attendance alone ≠ COMPLETED (unless explicit policy); COMPLETED_WITH_GAPS explicit
- Certificate eligibility UNKNOWN ≠ issue; checksum/idempotent; revoke preserves history
- CS handoff does not overwrite Customer Health; PA handoff source-labelled only (no usage/first-value fabrication)
- Training Participants ≠ auto Leads; attendance ≠ Marketing attribution

- [ ] Write failing Vitest → implement → PASS Waves 1–3
- [ ] SDD review gate before Wave 4

---

### Task 4: Wave 4 — UI/metrics/DQ/recon/Phase 23 pack/exit

**Files:** Metrics/reliabilityGate/search/exports/DQ/recon/lineage harden; thin UI honesty; docs PHASE_23_INPUTS + checklist + FINAL report; exit `READY_FOR_PHASE_23_WITH_BLOCKERS`; test Wave 4

**Interfaces / hardens:**
- Gate fail → UNAVAILABLE / value null
- Search/export/DQ/recon fail-closed scoped; no answer keys / broad assessment responses
- Progress ≠ quality ≠ completion; completion ≠ adoption
- Phase 23 pack honest (identity/source/consent/communication-eligibility; Training ≠ acquisition)
- Mislabel map pointer (tree-18 ≡ PRD 22; Demo preserved)
- Exit decision recorded

- [ ] Write failing Vitest → implement → PASS Waves 1–4
- [ ] SDD final whole-branch review before exit ratification

---

## Spec coverage

| Spec area | Tasks |
|-----------|-------|
| Compatibility / mislabel / Demo preserve / quarantine | 0 |
| Handoff / Request / Program spine / source retarget | 1 |
| Curriculum / trainers / cohorts / enrolment | 2 |
| Sessions / attendance / assessments / completion / certs / CS+PA | 3 |
| UI / metrics / Phase 23 pack / exit | 4 |

## Execution notes

- **BASE_SHA:** `7d9709a897bc0d4609ce8a6725aad7d9cf1cb835` (WORKING_TREE; no commits unless user asks)
- Work in-place on `v2` (prior phases uncommitted — do not use clean worktree that omits them)
- Execution: Subagent-Driven (locked in design)
- SDD artifacts: `.superpowers/sdd/task-N-brief-p22.md`, `task-N-report-p22.md`, `task-N-review-p22.md`, `progress-phase22.md`
