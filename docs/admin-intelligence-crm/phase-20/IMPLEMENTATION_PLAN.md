# Phase 20 Implementation Plan (from Wave 0 gaps)

**Date:** 2026-07-31  
**Mode after Wave 0:** User chooses Subagent-Driven (recommended) or Inline — **no Wave 1 code until then**.  
**Canonical path:** Extend `lib/admin/crm/conversions/**` (tree phase-16 ≡ PRD 20).  
**Tests:** `test/systemAdmin.crm.conversionPhase20Wave{1..4}.test.js` (and/or extend existing conversionWave tests).

## Wave 1 — Closed-Won readiness / acceptance / authority / approvals

**Gaps:** G20-01 … G20-07  
**Files:** `conversions/readiness.js`, `catalogue.js` readiness enums; `commercial/readiness.js` (+ acceptance/authority validators); `opportunities/close.js` as needed; thin UI/API only if Critical path broken.  
**Produces:**
- Expired/superseded/unaccepted commercial → not READY
- UNKNOWN ≠ READY; authority UNKNOWN / VERIFICATION_REQUIRED blocks
- Acceptance never inferred from view/open/silence
- Required approvals/discounts SoD-enforced
- Exact Closed-Won/conversion retry same id; no provision on close alone

**Steps:** failing Vitest → implement → re-run Wave 1 PASS → SDD review gate.

## Wave 2 — Saga idempotency / snapshot / duplicates

**Gaps:** G20-08 … G20-11  
**Files:** orchestrator/steps, snapshot lock/checksum, `customerMatch.js`, `customerProvision.js`, `businessBranch.js` contact link.  
**Produces:**
- Exact retry → same Conversion; conflicting idempotency → fail
- Snapshot immutable after lock; silent Proposal edit does not mutate
- EXACT_MATCH blocks auto-create; LINK_EXISTING; no auto-merge
- Contact duplicate/consent/cross-Customer deny
- Optimistic concurrency / resume without duplicate creates

**Steps:** failing Vitest → implement → Waves 1+2 PASS → review gate.

## Wave 3 — Request honesty + onboarding handoff

**Gaps:** G20-12 … G20-15  
**Files:** subscription/entitlement/tenant/user request steps; `handoffShared.js`, `onboardingHandoff.js`; related *Handoff modules.  
**Produces:**
- Never ACTIVATED/PROVISIONED/PAID without provider result
- One active onboarding handoff; exact retry same; correction supersedes with history
- Pending provisioning labelled pending; no CS Onboarding Project create
- No secrets in handoff payloads; no GL/fiscal side effects
- Partial failure → PARTIALLY_COMPLETED/BLOCKED; resume idempotent

**Steps:** failing Vitest → implement → Waves 1–3 PASS → review gate.

## Wave 4 — UI / metrics / DQ / recon / exports / Phase 21 pack / exit

**Gaps:** G20-16 … G20-20 (+ carries remain WITH_BLOCKERS)  
**Files:** conversion Overview/My Work/queues/detail; optional `/crm/closed-won/*` aliases; metrics/reliabilityGate/dataQuality/reconciliation/exports/search; i18n en+ny; exit docs.  
**Produces:**
- Gate fail → UNAVAILABLE / value null
- Search/export/DQ/recon portfolio fail-closed
- Closed-Won accepted value not labelled collected/recognised Revenue
- `PHASE_21_INPUTS.md`, `PHASE_21_READINESS_CHECKLIST.md`, `FINAL_PHASE_20_REPORT.md`, `FINAL_READINESS_DECISION.md` → **`READY_FOR_PHASE_21_WITH_BLOCKERS`**
- Domain contract phase label → 20

**Steps:** failing Vitest → implement → Waves 1–4 PASS → SDD final review.

## Explicit non-goals (all waves)

- Delete/renumber CS phase-17/18/19 code
- Consume Adoption `PHASE_20_INPUTS` as conversion requirements
- Parallel SalesConversion domain
- Fabricate acceptance/Customer/Tenant/ACTIVE/PAID/onboarding Project
- Tenant GL / MRA fiscal submit
