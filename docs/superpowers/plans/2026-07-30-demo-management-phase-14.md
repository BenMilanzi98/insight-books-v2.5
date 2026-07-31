# Sales Demo Management Phase 14 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Checkbox steps for tracking.

**Goal:** Ship `/insightbooks/crm/demos` with Demo Requests, Demos, Meeting-linked scheduling, versioned agendas/scripts, logical Demo Environments + safe data packs, checklists/rehearsals, delivery/attendance/recording governance, outcomes, follow-ups, Proposal/Trial handoffs, and Demo reporting — without Production clones, fabricated engagement, or Proposal/Tenant provision.

**Architecture:** Wave 0 forensic pack → `lib/admin/crm/demos/*` + CrmDemo* Prisma → schedule via Phase 13 Meeting/Calendar → content versions → logical env provisioner → delivery/ops. Recording provider NOT_AVAILABLE; Proposal/Trial = handoff payloads only.

**Tech Stack:** Next.js, Prisma, Vitest, AdminShell, Phase 13 Meeting/Calendar/Task/Follow-Up, eligibility, en/ny, owner/team/territory scope.

**Spec:** [docs/superpowers/specs/2026-07-30-demo-management-phase-14-design.md](../specs/2026-07-30-demo-management-phase-14-design.md)

## Global Constraints

- Demo ≠ Meeting ≠ Trial ≠ Proposal; Environment ≠ Production Tenant.
- Demo outcome ≠ win probability ≠ Closed Won ≠ Revenue.
- RSVP ≠ attendance; recording UNKNOWN ≠ GRANTED; provider NOT_AVAILABLE.
- Scheduling requires one CrmMeeting + Calendar Event; times reconcile.
- Logical env only — no Production DB/payment/MRA EIS/email connections.
- Provision/reset/handoff idempotent; no fabricated env/attendance/recording/feedback.
- No automatic Opportunity stage/probability/close-date changes.
- No Proposal/Quotation/Tenant/Subscription/Invoice creation; CoA admin stays removed.
- No false zeroes on metric/report gate failure.
- Commits only when user asks; WORKING_TREE OK; SQL + model guards if Prisma EPERM.

---

### Task 0: Wave 0 — Forensic audits + matrices

**Files:** `docs/admin-intelligence-crm/phase-14/*`

- [x] Validate Phase 13 `READY_FOR_PHASE_14_WITH_BLOCKERS`
- [x] CURRENT_* audits (architecture through export) + DQ/recon/privacy/security/performance
- [x] Matrices: source, domain, request/demo/readiness/participant/agenda/script/env/data/recording/outcome/reliability/security
- [x] Gap register + IMPLEMENTATION_PLAN + FINAL_READINESS_DECISION
- [x] CONDITIONAL GO for Wave 1 — **stop before Wave 1 code** unless user continues

---

### Task 1: Wave 1 — Request + Demo + schedule + participants + readiness spine

**Files:** `lib/admin/crm/demos/` (catalogue, numbering DMR/DEMO, requests, create/convert, status, readiness, participants, schedule); Prisma + `scripts/sql/crm-demo-phase14-wave1.sql`; APIs; UI hubs; tests `test/systemAdmin.crm.demoWave1.test.js`

**Interfaces:** `createDemoRequest`, `qualifyDemoRequest`, `convertDemoRequest` (idempotent), `createDemo`, `scheduleDemo` → Meeting+Calendar, `evaluateDemoReadiness`, participant CRUD

- [ ] Request/Demo numbers unique immutable
- [ ] Convert idempotent; Meeting required on schedule; times reconcile
- [ ] Readiness blocks READY_TO_DELIVER when required items missing
- [ ] No Proposal/Tenant provision; Vitest PASS

---

### Task 2: Wave 2 — Agenda / Script / Scenario / Content versioning

**Files:** agenda/script/scenario/content modules; SoD approve; customer-safe vs restricted projections; SQL wave2; APIs/UI; `test/systemAdmin.crm.demoWave2.test.js`

- [ ] Versioned; ACTIVE not directly editable; historical Demo pins versions
- [ ] Restricted Script never on invitations/Customer APIs
- [ ] en/ny script foundations; Vitest PASS

---

### Task 3: Wave 3 — Logical Environment + data packs + checklist/rehearsal

**Files:** environments/, dataPacks/, checklists/, rehearsals/; logical provisioner; Production-data detection; expiry/reset idempotency; SQL wave3; tests `test/systemAdmin.crm.demoWave3.test.js`

- [ ] DENV numbers; provision/reset idempotent; expiry required; DEMO banner
- [ ] Reject Production data/credentials; no Production connections
- [ ] Checklist/rehearsal block readiness on Critical fails; Vitest PASS

---

### Task 4: Wave 4 — Delivery + outcomes + handoffs + reports + Phase 15 pack

**Files:** delivery, attendance, recording gov, feedback, outcome, questions, follow-ups, proposal/trial handoffs; reports/schedules; FINAL_PHASE_14_REPORT, PHASE_15_INPUTS, PHASE_15_READINESS_CHECKLIST; SQL wave4; `test/systemAdmin.crm.demoWave4.test.js`

- [ ] Attendance source-backed; recording gov only; outcome ≠ auto Opportunity mutation
- [ ] Proposal/Trial handoffs idempotent payloads only
- [ ] Reports honesty-gated; exit READY_FOR_PHASE_15_WITH_BLOCKERS
- [ ] Vitest PASS

---

## File map

| Area | Paths |
|------|--------|
| Demo domain | `lib/admin/crm/demos/*` |
| SQL | `scripts/sql/crm-demo-phase14-wave{1,2,3,4}.sql` |
| APIs | `app/api/admin/crm/demos/**`, `demo-requests/**`, `demo-environments/**`, … |
| UI | `app/insightbooks/crm/demos/**` (+ supporting hubs) |
| Wave 0 / exit docs | `docs/admin-intelligence-crm/phase-14/*` |

---

## Plan self-review

- Spec locked decisions map to Tasks 0–4 (Approach B).
- Logical env, recording governance, required Meeting, reporting centre, handoff-only Proposal/Trial covered.
- No TBD blocking Wave 0.
- Commit steps omitted per global constraint.
