# Customer Onboarding Phase 17 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/insightbooks/customer-success/onboarding` with one canonical Request/Project onboarding spine that consumes Phase 16 handoffs, materialises versioned templates into workstreams/milestones/tasks, runs kick-off via Phase 13, governs Customer evidence by attestation, coordinates migration/MRA/training without fabricating completion, and drives go-live → stabilisation → handover → checksummed completion.

**Architecture:** Approach B waves. Approach 1 dual-entity `CustomerOnboardingRequest` + `CustomerOnboardingProject` under `lib/admin/customerSuccess/onboarding/*`. Phase 8 `CsOnboardingRecord` reconciled by link/migrate. Optional portal/migration engine/Training execution remain typed unavailable. Wave 0 docs-only stop gate before Wave 1 code.

**Tech Stack:** Next.js App Router, Prisma (+ SQL fallbacks), Vitest, AdminShell, Phase 16 conversion handoffs, Phase 13 Meetings/Calendar, Phase 8 CS foundations, Phase 7/9 Customer/Plan/entitlement, en/ny i18n.

**Spec:** [docs/superpowers/specs/2026-07-31-customer-onboarding-phase-17-design.md](../specs/2026-07-31-customer-onboarding-phase-17-design.md)

## Global Constraints

- Handoff ≠ Request ≠ Project; Onboarding ≠ Training ≠ Migration ≠ Support ≠ Customer Health; Go-live ≠ Completion; Progress ≠ Completion.
- Phase 16 handoff + accepted commercial snapshot are authoritative for Product/Plan/add-ons/quantities.
- Scope mismatch → Change Request + commercial/subscription handoff — never silent entitlement escalation.
- Exact retry → existing Request/Project/materialisation/certificate; conflicting idempotency → fail visibly.
- Customer Tasks require evidence or authorised verified waiver; no fabricated Customer/Task/Milestone/migration/training/MRA/go-live/completion.
- RSVP ≠ attendance; kick-off Meeting via Phase 13 or fail closed (`MEETING_SERVICE_UNAVAILABLE`).
- No direct OB/stock/Journal/AR/AP/tax posts; no MRA credentials fabrication; no unauthorised fiscal submit.
- Training readiness ≠ Training completion (Phase 18 only); Migration upload alone ≠ complete; MRA/Training `UNKNOWN` ≠ READY.
- Gate fail → never false zero; System CoA admin stays removed; Tenant CoA remains functional.
- No AI plans/scores/approvals; Customer portal = `CUSTOMER_PORTAL_NOT_CONFIGURED`.
- Commits only when user asks; WORKING_TREE OK; SQL + `hasCustomerOnboarding*Model` / `hasCs*` guards if Prisma EPERM.

## File map

| Area | Paths |
|------|--------|
| Onboarding domain | `lib/admin/customerSuccess/onboarding/**` (catalogue, numbering, requests, projects, status, templates, materialise, kickoff, stakeholders, requirements, scope, changeRequests, workstreams, milestones, tasks, evidence, responsibilities, readiness/*, migration, mraEis, training, testing, defects, goLive, stabilisation, handover, completion, health, progress, metrics, reliabilityGate, dq, recon, reports, permissions, cache) |
| Phase 8 reconcile | `lib/admin/customerSuccess/foundations.js`, `CsOnboardingRecord` link field |
| Prisma / SQL | `prisma/schema.prisma` + `scripts/sql/cs-onboarding-phase17-wave{1,2,3,4}.sql` |
| APIs | `app/api/admin/customer-success/onboarding/**`, `onboarding-requests/**`, `onboarding-templates/**` |
| UI | `app/insightbooks/customer-success/onboarding/**` (+ templates/reports/settings); extend conversion/CS customer deep-links |
| Integrations | Phase 16 `onboardingHandoff.js` (+ training/migration/MRA handoffs); Phase 13 `lib/admin/crm/meetings/*`; existing Tenant/User/RBAC/provisioning |
| Tests | `test/systemAdmin.cs.onboardingWave{1..4}.test.js` |
| Wave 0 / exit docs | `docs/admin-intelligence-crm/phase-17/*` |

---

### Task 0: Wave 0 — Forensic audits + matrices + readiness

**Files:** Create `docs/admin-intelligence-crm/phase-17/` audit pack per master prompt §5 (CURRENT_* onboarding audits, DQ/privacy/security/performance, gap register, IMPLEMENTATION_PLAN, PHASE_INPUT_VALIDATION). No application code.

**Interfaces:**
- Consumes: Phase 16 `PHASE_17_INPUTS.md`, `PHASE_17_READINESS_CHECKLIST.md`, design spec locks, Phase 8 `ONBOARDING_FOUNDATION` / `CsOnboardingRecord`
- Produces: CONDITIONAL GO / BLOCKED in Wave 0 readiness note (path: `docs/admin-intelligence-crm/phase-17/FINAL_READINESS_DECISION.md` as interim Wave 0 decision; full final report in Wave 4)

- [ ] Validate Phase 16 exit `READY_FOR_PHASE_17_WITH_BLOCKERS` (handoff ≠ execute; Customer/Tenant/Subscription pins; ONBOARDING/TRAINING/MIGRATION/MRA handoffs distinct)
- [ ] Audit routes, Phase 8 onboarding, Phase 16 handoffs, requests/projects/templates/kickoff/stakeholders/workstreams/milestones/tasks/checklists/responsibilities, tenant/biz/branch/user/config, accounting boundary, migration/MRA/training/testing/go-live/stabilisation/handover/completion, reports/exports/permissions — classify with prompt taxonomy (`CORRECT_AND_REUSABLE` … `BLOCKED`)
- [ ] Write CURRENT_* + ONBOARDING_* audits with real file paths (not empty placeholders)
- [ ] Matrices: source, domain, type, template, workstream, milestone, task, responsibility, tenant readiness, migration, MRA, training, testing, go-live, completion, reliability, security
- [ ] `PHASE_17_GAP_REGISTER.md` + `IMPLEMENTATION_PLAN.md` (gaps → Waves 1–4) + Wave 0 readiness decision
- [ ] Stop — **no Wave 1 code** until user chooses Subagent-Driven or Inline after CONDITIONAL GO

---

### Task 1: Wave 1 — Request + Project spine, numbering, state machines, handoff consume, idempotency

**Files:**
- Create: `lib/admin/customerSuccess/onboarding/` — `catalogue.js`, `numbering.js`, `model.js`, `requests.js`, `projects.js`, `status.js`, `handoffConsume.js`, `index.js`
- Create: `scripts/sql/cs-onboarding-phase17-wave1.sql` + Prisma models: `CustomerOnboardingRequest`, `CustomerOnboardingRequestStatusHistory`, `CustomerOnboardingProject`, `CustomerOnboardingProjectStatusHistory` (+ type catalogue seed table or const catalogue)
- Create: thin APIs under `app/api/admin/customer-success/onboarding-requests/**`, `onboarding/**` and thin pages under `app/insightbooks/customer-success/onboarding/**` (list/detail stubs OK)
- Wire: Phase 16 ONBOARDING handoff → `consumeOnboardingHandoff` (auto Request)
- Test: `test/systemAdmin.cs.onboardingWave1.test.js`

**Interfaces:**
- Consumes: Phase 16 handoff row (`CrmConversionDomainHandoff` type ONBOARDING), Customer/Tenant/Subscription ids from handoff payload
- Produces:
  - `consumeOnboardingHandoff({ actorContext, handoffId, idempotencyKey })` → Request
  - `validateOnboardingRequest` / `acceptOnboardingRequest` / `rejectOnboardingRequest`
  - `createOnboardingProject({ actorContext, onboardingRequestId, onboardingTemplateVersionId, targetKickoffDate, targetGoLiveDate, ownerAssignments, idempotencyKey })` — Wave 1 may accept `templateVersionId: null` only when status stays pre-materialisation OR use a minimal seeded DRAFT template stub; **prefer requiring a Wave-1 seeded STANDARD template version** so Project always pins `templateVersionId`
  - Numbers: `ONR-YYYY-######`, `ONB-YYYY-######`
  - Status transition helpers with immutable history; invalid transition throws
  - Exact retry same idempotency key → same Request/Project; conflicting payload → visible error
  - One Request → at most one Project (`CONVERTED_TO_PROJECT`)

- [ ] **Step 1: Write failing Vitest** covering:
  - Phase 16 handoff consume creates one `ONR-` Request
  - Exact handoff retry returns same Request (no duplicate)
  - Accept → convert creates one `ONB-` Project; second convert fails or returns same
  - Exact project create retry returns same Project
  - Conflicting idempotency payload fails
  - Invalid status transition rejected
  - Request without Customer/Tenant/Subscription fails validation
- [ ] **Step 2: Run** `npx vitest run test/systemAdmin.cs.onboardingWave1.test.js` — expect FAIL
- [ ] **Step 3: Implement** SQL/Prisma + lib + thin API/UI + model guards; seed minimal ACTIVE STANDARD template version if required for Project pin
- [ ] **Step 4: Re-run Vitest** — PASS; no Workstream materialisation beyond stub if deferred to Wave 2; no Tenant GL; handoff `executionStatus` may move to `IN_PROGRESS`/`ACKNOWLEDGED` only via typed update — never fabricate onboarding complete
- [ ] SDD review gate before Wave 2

---

### Task 2: Wave 2 — Templates, materialisation, kick-off (Phase 13), stakeholders, tasks/evidence, scope/CR

**Files:**
- Create: `templates.js`, `templateVersions.js`, `materialise.js`, `kickoff.js`, `stakeholders.js`, `requirements.js`, `scope.js`, `changeRequests.js`, `workstreams.js`, `milestones.js`, `tasks.js`, `evidence.js`, `responsibilities.js`, `dependencies.js`
- Create: `scripts/sql/cs-onboarding-phase17-wave2.sql` + Prisma for Template/Version/Workstream/Milestone/Task/Checklist/Stakeholder/Kickoff/Requirement/ScopeItem/Responsibility/ChangeRequest/TaskDependency (+ evidence attestation fields)
- Wire: `lib/admin/crm/meetings` for kick-off Meeting create/link
- Test: `test/systemAdmin.cs.onboardingWave2.test.js`

**Interfaces:**
- Produces:
  - Template version approve/activate; active version immutable
  - `materialiseOnboardingTemplate({ projectId, templateVersionId, idempotencyKey })` — Workstreams/Milestones/Tasks/Checklists once
  - `scheduleOnboardingKickoff({ projectId, meetingInput, idempotencyKey })` → `crmMeetingId`; RSVP vs attendance fields distinct
  - Stakeholder assign with Contact verification gate
  - `confirmOnboardingRequirements` / `detectScopeMismatch` → Change Request when mismatch
  - Task create/assign; `submitCustomerTaskEvidence({ taskId, actorContext, attestationReason, contactId, fileRef })`; `reviewCustomerTaskEvidence` approve/reject
  - Customer Task complete blocked without evidence source or authorised waiver
  - Dependency cycle detection

- [ ] **Step 1: Write failing Vitest** — materialise once on retry; kick-off creates/links Meeting once; RSVP accepted ≠ attendance; Customer Task cannot complete without evidence; evidence reject retains reason; scope mismatch creates CR and does not mutate Subscription entitlements; circular dependency rejected; Meeting unavailable → typed fail (mock)
- [ ] **Step 2: Run Vitest** — expect FAIL
- [ ] **Step 3: Implement** lib + SQL + thin UI tabs (kick-off, tasks, stakeholders, requirements)
- [ ] **Step 4: Re-run Vitest** — PASS
- [ ] SDD review gate before Wave 3

---

### Task 3: Wave 3 — Readiness coordination, go-live, stabilisation, handover, completion certificate

**Files:**
- Create: `readiness/tenant.js`, `readiness/businessBranch.js`, `readiness/users.js`, `readiness/configuration.js`, `readiness/accounting.js`, `readiness/evaluate.js`, `migration.js`, `mraEis.js`, `training.js`, `testing.js`, `defects.js`, `goLive.js`, `stabilisation.js`, `handover.js`, `completion.js`, `health.js`, `progress.js`
- Create: `scripts/sql/cs-onboarding-phase17-wave3.sql` + Prisma for ReadinessEvaluation, GoLive, GoLiveApproval, Stabilisation, Handover, Completion, CompletionCertificate, TestPlan/Case/Result, Defect, Risk, Issue, Document metadata (no credential storage)
- Test: `test/systemAdmin.cs.onboardingWave3.test.js`

**Interfaces:**
- Produces:
  - `evaluateOnboardingReadiness(projectId)` — dimensions; `UNKNOWN` ≠ READY
  - Migration state machine; file inventory metadata + security flags; recon gate blocks complete
  - MRA readiness states; credential status boundary only
  - Training coordination consuming Phase 16 TRAINING handoff; cannot set COMPLETED without Training-domain source (Phase 18 stub returns UNKNOWN/IN_PROGRESS)
  - `approveGoLive` / `executeGoLive` / `recordGoLiveOutcome` — Critical defect blocks; success → `STABILISATION`
  - Stabilisation exit criteria + approval
  - Handover create/accept
  - `evaluateOnboardingCompletion` / `issueCompletionCertificate` — checksum; exact retry same certificate; blocked without sign-offs/recon/handover
  - `calculateOnboardingProgress` / `calculateOnboardingHealth` — server-side, versioned rules
  - Accounting boundary assert helper: no journal/OB/stock create from onboarding modules

- [ ] **Step 1: Write failing Vitest** — UNKNOWN readiness blocks go-live; Critical defect blocks approval; successful go-live → STABILISATION not COMPLETED; migration COMPLETED rejected without recon; training COMPLETED rejected without Training source; completion without Customer sign-off fails; certificate checksum stable on retry; accounting boundary (no journal); Cross-Tenant project access denied
- [ ] **Step 2: Run Vitest** — expect FAIL
- [ ] **Step 3: Implement** readiness + go-live + completion path + thin UI tabs
- [ ] **Step 4: Re-run Vitest** — PASS
- [ ] SDD review gate before Wave 4

---

### Task 4: Wave 4 — UI hubs, metrics/reliability, DQ/recon, reports, Phase 8 migrate, Phase 18 pack

**Files:**
- Create/extend: Overview, My Work, Team, Calendar, queues, Context Bar, Request list/detail, Project list/detail tabs, Templates UI, Reports
- Create: `metrics.js`, `reliabilityGate.js`, `dataQuality.js`, `reconciliation.js`, `lineage.js`, `reports.js`, `exports.js`, `notifications.js`, `search.js`, `cache.js`
- Create: `scripts/sql/cs-onboarding-phase17-wave4.sql` as needed (snapshots, report schedules, Phase 8 link column)
- Modify: `lib/admin/customerSuccess/foundations.js` — project Project when `onboardingProjectId` present
- Docs: full `docs/admin-intelligence-crm/phase-17/` deliverables including `PHASE_18_INPUTS.md`, `PHASE_18_READINESS_CHECKLIST.md`, `FINAL_PHASE_17_REPORT.md`, `FINAL_READINESS_DECISION.md`
- i18n: en + ny keys for onboarding surfaces
- Test: `test/systemAdmin.cs.onboardingWave4.test.js`

**Interfaces:**
- Produces:
  - Overview cards via reliability gate — gate fail → `UNAVAILABLE` / `value: null` (never `0` as fake empty)
  - My Work scoped counts
  - Report catalogue subset for Wave 4 (Overview, At-Risk, Overdue Customer Tasks, Go-Live Readiness, Completion) + CSV/XLSX export path with permission recheck
  - Global search index entries for ONB/ONR numbers (no migration file contents, no credentials)
  - Phase 8 migrate: link existing `CsOnboardingRecord` → Project where resolvable; else leave UNKNOWN
  - Exit readiness `READY_FOR_PHASE_18_WITH_BLOCKERS`

- [ ] **Step 1: Write failing Vitest** — gate fail not zero; portfolio scope excludes other CS owner projects; search excludes inaccessible ONB; export strips credentials; Phase 8 linked record projects Project status; EN key resolve (smoke); certificate still idempotent after Wave 4
- [ ] **Step 2: Run Vitest** — expect FAIL
- [ ] **Step 3: Implement** UI + metrics + DQ/recon + docs + Phase 8 link migration
- [ ] **Step 4: Re-run Vitest** — PASS; run `npx vitest run test/systemAdmin.cs.onboardingWave{1,2,3,4}.test.js` regression
- [ ] Produce FINAL reports + Phase 18 input pack; set exit state
- [ ] SDD final review

---

## Spec coverage self-review

| Spec section | Task |
|--------------|------|
| §2–3 Locked decisions / hard rules | Global Constraints + all waves |
| §4 Dual-entity architecture | Task 1 |
| §5 Request model | Task 1 |
| §6 Project/types/templates | Task 1 seed + Task 2 |
| §7 Kick-off/stakeholders/scope | Task 2 |
| §8 Workstreams/milestones/tasks/evidence | Task 2 |
| §9 Readiness/go-live/stabilisation/completion | Task 3 |
| §10 Health/progress/metrics/reliability | Task 3 (calc) + Task 4 (UI/metrics) |
| §11 UI surfaces | Task 4 (thin stubs Tasks 1–3) |
| §12 Security/privacy/SoD | Tasks 1–4 permissions + Task 4 search/cache/export |
| §13 Waves | Tasks 0–4 |
| §14 Out of scope | Explicit typed gaps; no portal/Training engine |
| §15 Exit WITH_BLOCKERS | Task 4 FINAL_READINESS_DECISION |

**Placeholder scan:** none intentional. Wave 1 requires seeded STANDARD template version so Project always pins `templateVersionId` (no null-project ambiguity).

**Type consistency:** Request `ONR-`, Project `ONB-`; services named `consumeOnboardingHandoff`, `createOnboardingProject`, `materialiseOnboardingTemplate`, `scheduleOnboardingKickoff`, `submitCustomerTaskEvidence`, `evaluateOnboardingReadiness`, `issueCompletionCertificate` throughout.

---

## Execution handoff

Plan complete. After Wave 0 CONDITIONAL GO, choose:

1. **Subagent-Driven (recommended)** — fresh subagent per task + review between tasks  
2. **Inline Execution** — execute in this session with checkpoints  

Do not start Wave 1 code until Wave 0 stop gate clears and execution mode is chosen.
