# Lead Conversion & Closed-Won Phase 20 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ratify PRD Phase 20 Lead Conversion / Closed-Won by forensically mapping mislabelled phases, quarantining CS Onboarding/Training/Adoption, and hardening the existing `CrmConversion*` spine so Closed-Won, conversion, snapshot, duplicates, requests, and Phase 21 handoffs are trustworthy — without a second conversion domain or fabricated provision/activation/onboarding.

**Architecture:** Approach B waves. Approach 1 — extend `lib/admin/crm/conversions/**` (tree phase-16 ≡ PRD 20). New docs under `docs/admin-intelligence-crm/phase-20/`. CS tree phase-17/18/19 preserved with mislabel banners. Exit target `READY_FOR_PHASE_21_WITH_BLOCKERS`.

**Tech Stack:** Next.js App Router, Prisma (+ SQL fallbacks), Vitest, AdminShell, existing CRM pipeline/commercial/conversion services, Platform Customer/Tenant/Subscription/invitation boundaries, en/ny i18n.

**Spec:** [docs/superpowers/specs/2026-07-31-lead-conversion-closed-won-phase-20-design.md](../specs/2026-07-31-lead-conversion-closed-won-phase-20-design.md)  
**Prior design (alias):** [docs/superpowers/specs/2026-07-31-closed-won-conversion-phase-16-design.md](../specs/2026-07-31-closed-won-conversion-phase-16-design.md)

## Global Constraints

- PRD Phase 20 = Lead Conversion / Closed-Won; tree phase-16 code is the canonical implementation; do not create `SalesConversion*` parallel domain.
- Do not delete CS onboarding/training/adoption (tree 17–19); quarantine as `MISLABELLED_PHASE` / `FUTURE_PHASE_SCOPE`; do not let them redefine Phase 20.
- Acceptance ≠ Closed-Won ≠ Conversion ≠ Completion ≠ Onboarding handoff ≠ Provisioning request ≠ Provisioning result.
- UNKNOWN readiness ≠ READY; expired/superseded commercial versions cannot convert; exact retries must not duplicate Conversion/snapshot/Customer/Contact/requests/handoffs/certificates.
- No fabricated acceptance/approval/Customer/Contact/Tenant/Subscription ACTIVE/entitlement/invitation/handoff/onboarding completion.
- No Tenant GL / billing SoT change / MRA fiscal submission; no secrets in notes/exports; gate fail → never false zero; System CoA stays removed.
- Sales-team / territory / customer / tenant fail-closed on list/search/export/metrics/writes-by-id.
- Commits only when user asks; WORKING_TREE OK; SQL + `hasCrm*Model` guards if Prisma EPERM.
- Targeted harden only (Critical/High gaps); optional polish remains WITH_BLOCKERS.

## File map

| Area | Paths |
|------|--------|
| Conversion domain (harden) | `lib/admin/crm/conversions/**` |
| Closed-Won / readiness | `lib/admin/crm/opportunities/close.js`, `conversionReadiness.js`, commercial acceptance/approvals |
| Pipeline | `lib/admin/crm/pipeline/**`, `opportunities/close.js` |
| Commercial | `lib/admin/crm/commercial/**` |
| CS quarantine (docs only) | `docs/admin-intelligence-crm/phase-{17,18,19}/` banners; leave `lib/admin/customerSuccess/{onboarding,training,adoption}/**` intact |
| Prisma | Existing `CrmConversion*` — extend only if gap requires |
| APIs / UI | `app/api/admin/crm/conversions/**`, `app/insightbooks/crm/conversions/**`; optional thin `closed-won` aliases |
| Tests | `test/systemAdmin.crm.conversionPhase20Wave{1..4}.test.js` (and/or extend existing conversion tests) |
| Wave 0 / exit docs | `docs/admin-intelligence-crm/phase-20/*` |
| SDD ledger | `.superpowers/sdd/progress-phase20.md` (`*-p20.md`) |

---

### Task 0: Wave 0 — Forensic audits, compatibility map, CONDITIONAL GO

**Files:** Create full Wave 0 pack under `docs/admin-intelligence-crm/phase-20/` per master prompt §1 (README, PHASE_20_SCOPE, AUTHORITATIVE_ROADMAP_MAP, MISLABELLED_PHASE_ARTIFACT_AUDIT, PHASE_CONTENT_COMPATIBILITY_MAP, PHASE_INPUT_VALIDATION, CURRENT_* conversion audits, DQ/privacy/security/performance, GAP_REGISTER, IMPLEMENTATION_PLAN). Add mislabel banners to CS phase-17/18/19 READMEs. **No application code changes** except optional README banners.

**Interfaces:**
- Consumes: PRD roadmap (`Inteligence & Leads.txt`), tree phase-14/15/16 docs, `lib/admin/crm/conversions/**`, CS phase-17/18/19, Adoption PHASE_20_INPUTS (CS renewals — mark non-authoritative for PRD 20)
- Produces: CONDITIONAL GO / BLOCKED in phase-20 Wave 0 readiness note; compatibility classifications (CORRECT_AND_REUSABLE, MISLABELLED_PHASE, FUTURE_PHASE_SCOPE, …)

- [ ] Validate tree phase-16 conversion exit and map ≡ PRD 20 with real paths
- [ ] Audit mislabelled Demo/Commercial/Onboarding/Training/Adoption folders vs PRD 14–22
- [ ] Classify conversion surfaces READY/PARTIAL/gap with real file paths
- [ ] Write AUTHORITATIVE_ROADMAP_MAP + PHASE_CONTENT_COMPATIBILITY_MAP + MISLABELLED_PHASE_ARTIFACT_AUDIT (non-empty)
- [ ] Gap register → Waves 1–4; Wave 0 readiness CONDITIONAL GO or BLOCKED
- [ ] Banner CS phase-17/18/19: FUTURE vs PRD 20; do not delete code
- [ ] Stop — **no Wave 1 code** until user chooses Subagent-Driven or Inline after CONDITIONAL GO

---

### Task 1: Wave 1 — Closed-Won readiness, acceptance, authority, approvals harden

**Files:**
- Harden: `lib/admin/crm/conversions/` readiness modules; `lib/admin/crm/opportunities/close.js`; commercial acceptance/authority/approval validators as identified in Wave 0 gaps
- Thin UI/API only if Critical path broken
- Test: `test/systemAdmin.crm.conversionPhase20Wave1.test.js`

**Interfaces:**
- Produces / hardens:
  - Server readiness: expired/superseded/unaccepted commercial → not READY; UNKNOWN ≠ READY
  - Acceptance never inferred from view/open/silence
  - Authority UNKNOWN / VERIFICATION_REQUIRED blocks Closed-Won where policy requires
  - Required approvals/discounts SoD-enforced
  - `closeOpportunityWon` + conversion create remain idempotent; no provision side effects on close alone

- [ ] **Step 1: Write failing Vitest** — expired quote blocks; superseded proposal blocks; view≠acceptance; unknown authority blocks; unapproved discount blocks; exact Closed-Won/conversion retry same id
- [ ] **Step 2: Run** — expect FAIL on gaps
- [ ] **Step 3: Implement** minimal harden
- [ ] **Step 4: Re-run Wave 1** — PASS
- [ ] SDD review gate before Wave 2

---

### Task 2: Wave 2 — Conversion saga idempotency, snapshot immutability, customer/contact duplicates

**Files:**
- Harden: conversion create/orchestrator/steps, commercial snapshot lock/checksum, customer duplicate review, contact convert/link
- Test: `test/systemAdmin.crm.conversionPhase20Wave2.test.js`

**Interfaces:**
- Produces / hardens:
  - Exact retry → same Conversion; conflicting idempotency → fail
  - Snapshot immutable after lock; silent Proposal edit does not mutate snapshot
  - EXACT_MATCH Customer blocks auto-create; LINK_EXISTING path; no auto-merge
  - Contact duplicate link vs create; consent preserved; cross-Customer denied
  - Optimistic concurrency / step resume without duplicate downstream creates

- [ ] **Step 1: Write failing Vitest** covering above
- [ ] **Step 2: Run** — expect FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Re-run Wave 1+2** — PASS
- [ ] SDD review gate before Wave 3

---

### Task 3: Wave 3 — Request honesty + onboarding handoff

**Files:**
- Harden: subscription/entitlement/tenant/user request steps; training/migration/MRA/integration/CS requirement handoffs; onboarding handoff create/send/supersede/checksum
- Ensure statuses never jump to ACTIVATED/PROVISIONED/PAID without provider result
- Test: `test/systemAdmin.crm.conversionPhase20Wave3.test.js`

**Interfaces:**
- Produces / hardens:
  - Request ≠ result honesty for all provision/activation paths
  - One active onboarding handoff; exact retry same; correction supersedes with history
  - Handoff pending provisioning labelled pending; does not create CS Onboarding Project
  - No secrets in handoff payloads; no GL/fiscal side effects
  - Partial provider failure → PARTIALLY_COMPLETED/BLOCKED; resume idempotent

- [ ] **Step 1: Write failing Vitest** — no fabricated ACTIVATED; handoff idempotent; supersession; no Project create; resume after fail
- [ ] **Step 2: Run** — expect FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Re-run Waves 1–3** — PASS
- [ ] SDD review gate before Wave 4

---

### Task 4: Wave 4 — UI queues, metrics/reliability, DQ/recon, Phase 21 pack, exit

**Files:**
- Extend conversion Overview/My Work/queues/detail as needed; optional thin `/crm/closed-won/*` aliases
- Harden: metrics, reliabilityGate, dataQuality, reconciliation, exports, search (fail-closed; never false zero)
- Docs: `PHASE_21_INPUTS.md`, `PHASE_21_READINESS_CHECKLIST.md`, `FINAL_PHASE_20_REPORT.md`, `FINAL_READINESS_DECISION.md` → **`READY_FOR_PHASE_21_WITH_BLOCKERS`**
- i18n: en + ny conversion hub keys as needed
- Test: `test/systemAdmin.crm.conversionPhase20Wave4.test.js`

**Interfaces:**
- Produces:
  - Gate fail → UNAVAILABLE / value null
  - Search/export/DQ/recon portfolio/team/territory fail-closed
  - Closed-Won / accepted value not labelled as collected/recognised Revenue
  - Phase 21 pack documents handoff contract + carry blockers + mislabel map pointer
  - Exit decision recorded

- [ ] **Step 1: Write failing Vitest** — gate null; scope fail-closed; exit pack WITH_BLOCKERS; no fabricated zeroes
- [ ] **Step 2: Run** — expect FAIL
- [ ] **Step 3: Implement** UI/metrics/docs
- [ ] **Step 4: Re-run Waves 1–4** — PASS
- [ ] SDD final whole-branch review before exit ratification

---

## Spec coverage

| Spec area | Tasks |
|-----------|-------|
| Compatibility / mislabel / quarantine | 0 |
| Closed-Won readiness / acceptance / approvals | 1 |
| Conversion saga / snapshot / duplicates | 2 |
| Requests honesty / onboarding handoff | 3 |
| UI / metrics / Phase 21 pack / exit | 4 |
| Hard rules (honesty, fail-closed, no GL) | All |

## Execution notes

- **BASE_SHA** for reviews: `7d9709a897bc0d4609ce8a6725aad7d9cf1cb835` (WORKING_TREE; Phases 7–19 dirty — scope diffs to conversion + phase-20 docs)
- Work **in-place** on `v2`
- After Task 0 CONDITIONAL GO, user picks **Subagent-Driven** (recommended) or Inline
- Do **not** start PRD Phase 21 onboarding re-home until Phase 20 exit ratified
- Do **not** treat Adoption `PHASE_20_INPUTS` as this phase’s scope
