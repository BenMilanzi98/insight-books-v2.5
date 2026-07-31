# Customer Health & Customer Success Phase 8 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship explainable Customer Health (`/insightbooks/intelligence/customer-health`) and portfolio-scoped CS Ops (`/insightbooks/customer-success`) on Phase 7 360/signals/portfolios — no ML, no false zeroes, no invented adoption/support.

**Architecture:** Wave 0 matrices → dual libs `lib/admin/health/*` + `lib/admin/customerSuccess/*` → APIs → UI. Missing health dims = NOT_APPLICABLE + renormalise; confidence separate from score; CS cases from deterministic signals/health with idempotent automation.

**Tech Stack:** Next.js App Router, Prisma (+ SQL fallbacks), Vitest, AdminShell, metric envelopes, en/ny, `authorizeAdminDecision`, portfolioScope.

**Spec:** [docs/superpowers/specs/2026-07-28-customer-health-success-phase-08-design.md](../specs/2026-07-28-customer-health-success-phase-08-design.md)

## Global Constraints

- Tenant = Customer; never Tenant Sale / Tenant GL as SaaS revenue.
- Health score is explainable 0–100 + band + **separate confidence**; never churn/renewal probability.
- Missing dimensions: NOT_APPLICABLE + EXCLUDE_AND_RENORMALISE; never score missing as 0.
- Initial scored dims only: Commercial, Engagement (login proxy), MRA EIS, Relationship (owner/signals).
- Adoption, Support, Onboarding, Training, NPS: N/A / NOT_INSTRUMENTED until sources exist.
- Portfolio scope on all lists/mutations; agents cannot leak cross-tenant.
- CS actions do not mutate source facts (subs, payments, usage, EIS).
- Automations: deterministic + idempotent trigger identity.
- `/insightbooks/chart-of-accounts` stays removed.
- Commits only when user asks.

---

### Task 0: Wave 0 — Forensic audits + matrices

**Files:** `docs/admin-intelligence-crm/phase-08/*` (see design §4); handoff pointer from phase-07 already exists (`PHASE_08_INPUTS.md`).

- [x] Validate Phase 7 READY_FOR_PHASE_8_WITH_BLOCKERS + inputs
- [x] Write CURRENT_* audits (health, CS, playbooks, tasks, renewals, onboarding, training, reviews, comms, escalations, surveys, reports, exports)
- [x] Write HEALTH_SOURCE / DEFINITION / MISSING_DATA matrices + CS workflow/security matrices
- [x] Gap register + IMPLEMENTATION_PLAN + FINAL_READINESS_DECISION (enter Wave 1)
- [x] Stop before Wave 1 code unless user says continue

---

### Task 1: Wave 1 — Health definition + engine + snapshots + APIs

**Files:**
- Create: `lib/admin/health/catalogue.js`, `definitions.js`, `dimensions/*.js`, `evaluate.js`, `confidence.js`, `overrides.js`, `snapshots.js`, `reconcile.js`, `pack.js`, `authz.js`, `index.js`
- Create: `app/api/admin/intelligence/customer-health/**` (overview, definitions, evaluate, snapshots, `[tenantId]`, reconcile, export)
- Modify: `lib/admin/permissions.js` — `intel.customerHealth.read`, `intel.customerHealth.manageDefinitions`, `intel.customerHealth.rebuild`
- Prisma (or SQL fallback): `CustomerHealthDefinition`, `CustomerHealthSnapshot` (immutable rows; rebuild creates new snapshot)
- Test: `test/systemAdmin.customerHealth.test.js`

**Interfaces:**
- `getActiveHealthDefinition(prisma) → { version, weights, bands, overrides, missingPolicy: 'EXCLUDE_AND_RENORMALISE' }`
- `evaluateCustomerHealth(prisma, { admin, tenantId, asOf?, definitionVersion? }) → { score|null, band, confidence, dimensions[], drivers[], missing[], overrides[], forbidden? }`
- `persistHealthSnapshot(prisma, evaluation) → snapshot`
- Dimension status enum: `SCORED | NOT_APPLICABLE | UNAVAILABLE | FAILED`

**v1 weights (eligible only; renormalise when N/A):**

| Dimension | Base weight | Source |
|-----------|-------------|--------|
| commercial | 0.35 | `lib/admin/customers/commercial.js` |
| engagement | 0.25 | `lib/admin/customers/engagement.js` (login proxy) |
| mraEis | 0.20 | `lib/admin/customers/mraEis.js` |
| relationship | 0.20 | ownership + open Phase 7 signals |

- [ ] Failing tests: missing dim ≠ 0; suspended override CRITICAL; portfolio forbidden; score null when insufficient evidence
- [ ] Implement evaluate + snapshots + APIs
- [ ] `npx vitest run test/systemAdmin.customerHealth.test.js` PASS

---

### Task 2: Wave 2 — Health UI + CS shell / nav / i18n

**Files:**
- Create: `lib/admin/healthNav.js`, `lib/admin/customerSuccessNav.js`
- Create: `components/admin/health/*`, `components/admin/customerSuccess/*` (shell only)
- Create pages: `app/insightbooks/intelligence/customer-health/**`, `app/insightbooks/customer-success/**` (command centre + stubs matrix-gated)
- Modify: `lib/admin/adminNav.js`, `locales/en|ny/admin-pages.json`, `NAV_PERMISSION_MAP`
- Permissions: `systemAdmin.customerSuccess.read`, `systemAdmin.customerSuccess.manageCases` (read shell first)

- [ ] Health overview shows score/band/confidence/drivers; UNAVAILABLE dims labelled N/A not 0
- [ ] CS Command Centre shell loads with portfolio filter; section cards gated
- [ ] Nav permission map complete; vitest nav PASS

---

### Task 3: Wave 3 — Cases, tasks, interventions, automation, renewals

**Files:**
- Prisma/SQL: `CsCase`, `CsTask`, `CsIntervention`, `CsRenewalWorkspace` (+ link to tenant, portfolio, signal/health trigger)
- Create: `lib/admin/customerSuccess/cases.js`, `tasks.js`, `interventions.js`, `automation.js`, `renewals.js`, `authz.js`, `index.js`
- APIs: `/api/admin/customer-success/cases|tasks|interventions|renewals|automations/**`
- UI: cases queue, case detail, tasks, interventions, renewals
- Test: `test/systemAdmin.customerSuccess.test.js`

**Interfaces:**
- `idempotencyKey({ tenantId, triggerType, triggerCode, definitionVersion }) → string`
- `openCaseFromSignal(prisma, { admin, tenantId, signalCode, signalId? })` — no-op if open case with same key
- `openCaseFromHealth(prisma, { admin, tenantId, band, snapshotId })` — only for AT_RISK/CRITICAL per definition
- Renewal outcome write only when `AccountSubscription` evidence matches claimed outcome

- [ ] Agent without portfolio cannot open/read foreign case
- [ ] Duplicate trigger does not create second open case
- [ ] Renewal outcome rejected without subscription evidence
- [ ] Vitest PASS

---

### Task 4: Wave 4 — Playbooks, success plans, foundations, handoffs, export, Phase 9 pack

**Files:**
- Prisma/SQL: `CsPlaybook`, `CsPlaybookExecution`, `CsSuccessPlan`, `CsSuccessGoal`, `CsExpansionHandoff` (+ optional onboarding/training/survey tables as stubs if needed — no invented progress)
- Create: playbooks, plans, goals, handoffs, export modules
- UI: playbooks, success plans, onboarding/training/survey pages as source-gated UNAVAILABLE when empty
- Docs: `FINAL_PHASE_08_REPORT.md`, `PHASE_09_INPUTS.md`, `PHASE_09_READINESS_CHECKLIST.md`

- [ ] Playbook execution creates tasks deterministically from definition steps
- [ ] Expansion handoff is record-only (no CRM opportunity / auto upgrade)
- [ ] Onboarding/training/survey show NOT_INSTRUMENTED unless rows exist
- [ ] Final readiness **READY_FOR_PHASE_9_WITH_BLOCKERS** if adoption/support/onboarding still missing
- [ ] Related vitest PASS

---

## Plan self-review

| Spec section | Task |
|--------------|------|
| Wave 0 audits/matrices | Task 0 |
| Health engine + snapshots | Task 1 |
| Dual UI surfaces + nav | Task 2 |
| Cases/tasks/interventions/renewals | Task 3 |
| Playbooks/plans/handoffs/Phase 9 pack | Task 4 |
| Missing-dim renormalise + confidence | Task 1 |
| Idempotent automation | Task 3 |
| Expected READY_FOR_PHASE_9_WITH_BLOCKERS | Task 4 |

No TBD blocking Wave 0. Commits optional per user rule.
