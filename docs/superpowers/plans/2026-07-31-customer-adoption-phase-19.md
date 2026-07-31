# Customer Adoption Phase 19 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/insightbooks/customer-success/adoption` with one canonical Request/Plan Adoption spine that consumes Phase 18 Training Program COMPLETED (hybrid + manual + onboarding handover attach), delivers role-based milestones and value outcomes from Phase 9 read-only evidence, champion/dormancy recovery via Phase 8 interventions, and expansion/renewal handoffs — without inventing usage, fabricating MET/COMPLETED, duplicating Phase 8/9 engines, or executing billing/entitlements.

**Architecture:** Approach B waves. Approach 1 dual-entity `CustomerAdoptionRequest` + `CustomerAdoptionPlan` under `lib/admin/customerSuccess/adoption/**`. Phase 8 Success Plan / Playbook / Intervention linked by id. Phase 9 product-analytics consumed as evidence snapshots (gate fail → UNAVAILABLE). Wave 0 docs-only stop gate before Wave 1 code. Exit target `READY_FOR_PHASE_20_WITH_BLOCKERS`.

**Tech Stack:** Next.js App Router, Prisma (+ SQL fallbacks), Vitest, AdminShell, Phase 18 Training APIs, Phase 17 onboarding handover, Phase 8 CS plans/playbooks/interventions/authz, Phase 9 `lib/admin/productAnalytics/*`, Phase 11 Contacts, en/ny i18n.

**Spec:** [docs/superpowers/specs/2026-07-31-customer-adoption-phase-19-design.md](../specs/2026-07-31-customer-adoption-phase-19-design.md)

## Global Constraints

- Handoff/attach ≠ Request ≠ Plan ≠ Milestone ≠ Intervention ≠ Expansion execute.
- Only Phase 18 Program aggregate `COMPLETED` auto-creates Request; `COMPLETED_WITH_GAPS` / partial participant ≠ auto Request; onboarding attach never invents Training COMPLETED.
- Phase 8 historical COMPLETED ≠ Adoption Plan COMPLETED without linked Plan evidence.
- Phase 9 gate fail / missing instrumentation → evidence UNAVAILABLE / milestone UNKNOWN — never invent MET or KPI zeroes.
- Plan COMPLETED requires critical milestones MET|WAIVED + value review + evaluation (no ungated FSM COMPLETED).
- Dormancy RECOVERED requires usage-return snapshot and/or attested outreach — never auto-complete from signal absence.
- Expansion handoff ≠ Subscription / Entitlement / Platform Invoice / Tenant GL mutations.
- Interventions via Phase 8 APIs only; exact retries must not duplicate Request/Plan/milestone/dormancy/handoff rows.
- Portfolio fail-closed on list/search/export/DQ/metrics/writes-by-id; gate fail → never false zero; System CoA stays removed.
- Commits only when user asks; WORKING_TREE OK; SQL + `hasCustomerAdoption*Model` guards if Prisma EPERM.
- Carry Phase 18 blockers typed unavailable (virtual provider, recording, rich banks, training portal, payment/e-sign).

## File map

| Area | Paths |
|------|--------|
| Adoption domain | `lib/admin/customerSuccess/adoption/**` (catalogue, numbering, model, requests, plans, status, trainingConsume, handoverAttach, milestones, valueOutcomes, evidence, champions, dormancy, interventions, expansion, completion, listScope, planAccess, metrics, reliabilityGate, dataQuality, reconciliation, lineage, reports, exports, search, myWork, health, permissions, index) |
| Phase 18 consume | `lib/admin/customerSuccess/training/completion.js`, `programs.js`, `certificates.js` (read-only) |
| Phase 17 attach | `lib/admin/customerSuccess/onboarding/handover.js` (attach refs only) |
| Phase 8 reconcile | `lib/admin/customerSuccess/plans.js`, `playbooks.js`, `interventions.js`, `authz.js`, `foundations.js` |
| Phase 9 evidence | `lib/admin/productAnalytics/{firstValue,adoption,signals}.js` |
| Prisma / SQL | `prisma/schema.prisma` + `scripts/sql/cs-adoption-phase19-wave{1,2,3,4}.sql` |
| APIs | `app/api/admin/customer-success/adoption-requests/**`, `adoption/**`, `adoption-plans/**` |
| UI | `app/insightbooks/customer-success/adoption/**`; thin deep-links from onboarding/training/CS customer |
| Tests | `test/systemAdmin.cs.adoptionWave{1..4}.test.js` |
| Wave 0 / exit docs | `docs/admin-intelligence-crm/phase-19/*` |
| SDD ledger | `.superpowers/sdd/progress-phase19.md` (briefs/reports `*-p19.md`) |

---

### Task 0: Wave 0 — Forensic audits + matrices + readiness

**Files:** Create `docs/admin-intelligence-crm/phase-19/` audit pack (CURRENT_* adoption audits, Phase 8/9 reconcile maps, DQ/privacy/security, gap register, IMPLEMENTATION_PLAN, PHASE_INPUT_VALIDATION). No application code.

**Interfaces:**
- Consumes: Phase 18 `PHASE_19_INPUTS.md`, `PHASE_19_READINESS_CHECKLIST.md`, `FINAL_READINESS_DECISION.md`, design locks, Phase 8 plans/playbooks/interventions, Phase 9 productAnalytics, Phase 17 handover
- Produces: CONDITIONAL GO / BLOCKED in `docs/admin-intelligence-crm/phase-19/` Wave 0 readiness note (full final report in Wave 4)

- [ ] Validate Phase 18 exit `READY_FOR_PHASE_19_WITH_BLOCKERS` (Training COMPLETED honesty; no invent zeroes; Project not auto-COMPLETED)
- [ ] Audit routes, Training consume surfaces, Phase 8 CS plans/playbooks/interventions, Phase 9 first-value/adoption/signals, onboarding handover, existing intelligence adoption stubs — classify READY/PARTIAL/NOT_FOUND with real paths
- [ ] Write CURRENT_* + ADOPTION_* audits with real file paths (not empty)
- [ ] Matrices: source, request, plan, milestone evidence, value, champion, dormancy, intervention link, expansion handoff, reliability, security, Phase 8/9 reconcile
- [ ] `PHASE_19_GAP_REGISTER.md` + `IMPLEMENTATION_PLAN.md` (gaps → Waves 1–4) + Wave 0 readiness decision
- [ ] Stop — **no Wave 1 code** until user chooses Subagent-Driven or Inline after CONDITIONAL GO

---

### Task 1: Wave 1 — Request + Plan spine, numbering, Training consume, manual, handover attach, status policy

**Files:**
- Create: `lib/admin/customerSuccess/adoption/` — `catalogue.js`, `numbering.js`, `model.js`, `requests.js`, `plans.js`, `status.js`, `trainingConsume.js`, `handoverAttach.js`, `listScope.js`, `planAccess.js`, `permissions.js`, `index.js`
- Create: `scripts/sql/cs-adoption-phase19-wave1.sql` + Prisma: Request/RequestStatusHistory/Plan/PlanStatusHistory/PlanTemplate/PlanTemplateVersion (+ seed ACTIVE default template)
- Thin APIs/UI under `app/api/admin/customer-success/adoption-requests/**`, `adoption-plans/**`, `app/insightbooks/customer-success/adoption/**`
- Test: `test/systemAdmin.cs.adoptionWave1.test.js`

**Interfaces:**
- Produces:
  - `consumeTrainingCompletionForAdoption({ actorContext, programId, idempotencyKey })` → Request `ADR-` only when Program aggregate status is `COMPLETED`
  - Reject auto-create for `COMPLETED_WITH_GAPS` / `IN_PROGRESS` / partial participant counts
  - `createManualAdoptionRequest` / `validateAdoptionRequest` / `acceptAdoptionRequest` / `rejectAdoptionRequest`
  - `attachOnboardingHandoverToAdoption({ actorContext, handoverId, requestId|planId, idempotencyKey })` — attach only; never sets Training COMPLETED
  - `createCustomerAdoptionPlan({ actorContext, adoptionRequestId, planTemplateVersionId, ownerAssignments, idempotencyKey })` → Plan `ADP-` with pinned templateVersionId
  - Status transitions; `COMPLETED` / `HANDED_TO_RENEWALS` blocked until Wave 2/3 evaluation hooks exist (or throw `COMPLETION_POLICY_REQUIRED`)
  - Exact retry same key → same row; conflict → fail; one Request → one Plan
  - `resolveAdoptionListScope` / `loadAdoptionPlanForActor` / `loadAdoptionRequestForActor` fail-closed portfolio

- [ ] **Step 1: Write failing Vitest** — Training COMPLETED→ADR; retry same; WITH_GAPS no Request; accept→ADP once; plan retry same; conflict fails; invalid transition throws; missing Customer/Tenant fails; template pin required; portfolio empty list `[]`; cross-tenant plan load denied
- [ ] **Step 2: Run** `npx vitest run test/systemAdmin.cs.adoptionWave1.test.js` — expect FAIL
- [ ] **Step 3: Implement** SQL/Prisma + lib + thin API/UI + model guards
- [ ] **Step 4: Re-run Vitest** — PASS; no milestones/value yet; no Tenant GL
- [ ] SDD review gate before Wave 2

---

### Task 2: Wave 2 — Milestones, value outcomes, Phase 9 evidence, Plan completion evaluation

**Files:**
- Create: `milestones.js`, `valueOutcomes.js`, `evidence.js`, `completion.js`, `health.js`
- Create: `scripts/sql/cs-adoption-phase19-wave2.sql` + Prisma Milestone/ValueOutcome/EvidenceSnapshot models
- Wire: Phase 9 `firstValue` / `adoption` / `signals` read-only; Phase 18 cert/program read for TRAINING_CERT mode
- Modify: `status.js` — Plan → `COMPLETED` requires `evaluateAdoptionPlanCompletion` + manage + planAccess
- Test: `test/systemAdmin.cs.adoptionWave2.test.js`

**Interfaces:**
- Produces:
  - Materialise milestones from pinned template (idempotent once per plan/templateVersion)
  - `evaluateAdoptionMilestone({ planId, milestoneId, actorContext })` — PRODUCT_ANALYTICS / TRAINING_CERT / CS_ATTESTATION / MIXED
  - Gate fail / missing analytics → status UNKNOWN + evidence UNAVAILABLE (never MET)
  - `attestAdoptionMilestone` / `waiveAdoptionMilestone` (SoD on critical waiver)
  - `recordAdoptionValueOutcome` — snapshot + lineage; null/UNAVAILABLE not false zero
  - `evaluateAdoptionPlanCompletion` — all critical milestones MET|WAIVED + value review sign-off + no blocking Critical DQ
  - `transitionAdoptionPlanStatus` to COMPLETED blocked unless evaluation passes (or audited executive waiver)

- [ ] **Step 1: Write failing Vitest** — analytics gate fail ≠ MET; Training WITH_GAPS cert path ≠ MET for TRAINING_CERT requiring Program COMPLETED; any-one-milestone ≠ Plan COMPLETED; ungated COMPLETED transition rejected; attestation requires manage+access; value missing → UNAVAILABLE null
- [ ] **Step 2: Run Vitest** — expect FAIL
- [ ] **Step 3: Implement** lib + SQL + thin UI tabs
- [ ] **Step 4: Re-run Wave 1+2** — PASS
- [ ] SDD review gate before Wave 3

---

### Task 3: Wave 3 — Champions, dormancy recovery, Phase 8 intervention links, expansion handoffs

**Files:**
- Create: `champions.js`, `dormancy.js`, `interventions.js`, `expansion.js`
- Create: `scripts/sql/cs-adoption-phase19-wave3.sql` + Prisma Champion/DormancyCase/ExpansionHandoff (+ link tables)
- Wire: Phase 8 `interventions.js` / `playbooks.js` create/link only; Phase 9 signals for dormancy queue
- Test: `test/systemAdmin.cs.adoptionWave3.test.js`

**Interfaces:**
- Produces:
  - `upsertAdoptionChampion` — contact-verified; no fabricated engagement score
  - `listDormancyRiskQueue` — Phase 9 VALUE_THEN_INACTIVE / inactive-class; UNAVAILABLE if analytics missing (not empty-as-healthy zero)
  - `openDormancyRecoveryCase` / `linkPhase8Intervention` / `attestDormancyOutcome`
  - `RECOVERED` blocked without usage-return snapshot and/or attested outreach
  - `createExpansionHandoff` / `acknowledgeExpansionHandoff` — statuses stop at HANDED_OFF/ACKNOWLEDGED; no Subscription/entitlement/invoice writes
  - Exact retry same expansion key → same handoff; writes use `loadAdoptionPlanForActor`

- [ ] **Step 1: Write failing Vitest** — dormancy RECOVERED without evidence fails; analytics missing → UNAVAILABLE not healthy zero; intervention link requires Phase 8 id; expansion handoff idempotent; expansion does not call billing/entitlement; cross-portfolio write denied
- [ ] **Step 2: Run Vitest** — expect FAIL
- [ ] **Step 3: Implement** + thin UI tabs
- [ ] **Step 4: Re-run Wave 1+2+3** — PASS
- [ ] SDD review gate before Wave 4

---

### Task 4: Wave 4 — UI hubs, metrics/reliability, DQ/recon, Phase 8 reconcile, Phase 20 pack

**Files:**
- Create/extend: Overview, My Work, Team, Portfolio, Attention/Dormancy, Context Bar, Request/Plan lists/details, reports
- Create: `metrics.js`, `reliabilityGate.js`, `dataQuality.js`, `reconciliation.js`, `lineage.js`, `reports.js`, `exports.js`, `search.js`, `myWork.js`, `cache.js`
- Create: `scripts/sql/cs-adoption-phase19-wave4.sql` as needed
- Modify: Phase 8 foundations/plans projection when `adoptionPlanId` linked; broken link → UNKNOWN not legacy COMPLETED
- Docs: full phase-19 pack including `PHASE_20_INPUTS.md`, `PHASE_20_READINESS_CHECKLIST.md`, `FINAL_PHASE_19_REPORT.md`, update `FINAL_READINESS_DECISION.md` → **`READY_FOR_PHASE_20_WITH_BLOCKERS`**
- i18n: en + ny `customerSuccess.adoptionHub.*` keys
- Test: `test/systemAdmin.cs.adoptionWave4.test.js`

**Interfaces:**
- Produces:
  - Overview/metric cards via reliability gate (fail → UNAVAILABLE / value null)
  - Search ADR/ADP (+ handoff ids) portfolio-scoped; empty scope → `[]`
  - Export/DQ/recon portfolio-scoped; never invent `totalRequests: 0` / `lineageIntact: true` as success when incomplete
  - My Work owner + portfolio scoped
  - Phase 20 pack honesty (carry blockers listed)
  - Exit decision `READY_FOR_PHASE_20_WITH_BLOCKERS`

- [ ] **Step 1: Write failing Vitest** — gate fail null; search/export/DQ fail-closed; false-zero request count rejected; foundations broken ≠ COMPLETED; Phase 20 pack present with WITH_BLOCKERS
- [ ] **Step 2: Run Vitest** — expect FAIL
- [ ] **Step 3: Implement** UI + metrics + docs + i18n
- [ ] **Step 4: Re-run Waves 1–4** — PASS
- [ ] SDD final whole-branch review before exit ratification

---

## Spec coverage

| Spec area | Tasks |
|-----------|-------|
| Request/Plan spine + hybrid entry | 0, 1 |
| Milestones / value / Phase 9 evidence / Plan completion | 2 |
| Champions / dormancy / Phase 8 interventions / expansion | 3 |
| UI / metrics / DQ / recon / Phase 20 pack / exit | 4 |
| Wave 0 forensic + CONDITIONAL GO | 0 |
| Hard rules (honesty, fail-closed, handoff≠execute, no GL) | All |

## Execution notes

- **BASE_SHA** for reviews: `7d9709a897bc0d4609ce8a6725aad7d9cf1cb835` (WORKING_TREE; Phases 7–18 dirty — scope diffs to adoption plane)
- Work **in-place** on `v2` (no worktree from HEAD — would omit Phase 18 deps)
- SDD artifacts: `.superpowers/sdd/progress-phase19.md`, `task-N-brief-p19.md`, `task-N-report-p19.md`, `task-N-review-p19.md`
- After Task 0 CONDITIONAL GO, user picks **Subagent-Driven** (recommended) or Inline
- Do **not** start Phase 20 until Phase 19 exit ratified
