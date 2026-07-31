# Phase 21 Implementation Plan (from Wave 0 gaps)

**Date:** 2026-07-31  
**Mode:** Subagent-Driven (user confirmed) — Wave 1 may proceed after controller review of Wave 0 **CONDITIONAL GO**.  
**Canonical path:** Extend `lib/admin/customerSuccess/onboarding/**` (tree phase-17 ≡ PRD 21).  
**Tests:** `test/systemAdmin.cs.onboardingPhase21Wave{1..4}.test.js` (and/or extend existing `onboardingWave*` tests).  
**Authoritative plan:** [`docs/superpowers/plans/2026-07-31-customer-onboarding-phase-21.md`](../../superpowers/plans/2026-07-31-customer-onboarding-phase-21.md)

## Wave 0 — Forensic pack (this directory)

**Status:** Complete 2026-07-31  
**Produces:** README, scope, roadmap map, mislabel audit, compatibility map, PHASE_INPUT_VALIDATION, CURRENT_* audits, DQ/privacy/security/performance, GAP_REGISTER, IMPLEMENTATION_PLAN, FINAL_READINESS_DECISION → **CONDITIONAL GO**. Training/Adoption FUTURE banners.

## Wave 1 — Handoff validate/accept + Project spine harden

**Gaps:** G21-01 … G21-06  
**Files:** `handoffConsume.js` (+ accept/validate helpers), `requests.js`, `projects.js`, `status.js`, templates/materialise edges; test Wave 1.  
**Produces:**
- Handoff checksum validation; UNKNOWN ≠ VALID
- `acceptOnboardingHandoff` idempotent; exact retry same; correction/supersession history
- Project create after accept; ONB- numbering; template pin; one active Project; conflicting idempotency fails
- Invalid status transitions throw

**Steps:** failing Vitest → implement → PASS Wave 1 → SDD review gate.

## Wave 2 — Readiness honesty + accounting boundary

**Gaps:** G21-07 … G21-14 (partial)  
**Files:** `readiness/*`, new provision/subscription/entitlement helpers as needed, `accountingBoundary.js`, `migration.js`, integration coord stub; test Wave 2.  
**Produces:**
- Request ≠ READY/ACTIVE/PROVISIONED without provider result
- Invitation sent ≠ ACCESS_VALID; no fabricated Tenant/User IDs
- Migration coordinate/reconcile only; secrets redacted
- Accounting: governed services only; no balance edit / fake journal / CoA admin
- Portfolio fail-closed on readiness writes-by-id

**Steps:** failing Vitest → implement → Waves 1–2 PASS → review gate.

## Wave 3 — Go-live / completion / CS handover / Phase 22 Training handoff

**Gaps:** G21-15 … G21-22  
**Files:** `goLive.js`, cutover helper, `stabilisation.js`, `completion.js`, `handover.js`, `training.js` (+ Phase 22 handoff emit); test Wave 3.  
**Produces:**
- Go-live readiness UNKNOWN ≠ READY; Critical/High defects block; SoD
- Execution ≠ schedule; rollback preserves evidence
- Completion evidence chain; certificate checksum idempotent; COMPLETED_WITH_GAPS
- Phase 22 Training handoff checksum/idempotent; never create Programs/Sessions/attendance/certs
- CS handover does not overwrite Customer Health

**Steps:** failing Vitest → implement → Waves 1–3 PASS → review gate.

## Wave 4 — UI/metrics/DQ/recon/Phase 22 pack/exit

**Gaps:** G21-23 … G21-28  
**Files:** metrics/reliabilityGate/search/exports/DQ/recon; thin UI; docs `PHASE_22_INPUTS` + checklist + FINAL report; exit decision; test Wave 4.  
**Produces:**
- Gate fail → UNAVAILABLE / value null
- Search/export/DQ/recon fail-closed scoped
- Progress ≠ readiness ≠ completion; completion ≠ adoption
- Phase 22 pack honest; mislabel map pointer
- Exit `READY_FOR_PHASE_22_WITH_BLOCKERS`

**Steps:** failing Vitest → implement → Waves 1–4 PASS → SDD final whole-branch review.

## Expected phase exit

`READY_FOR_PHASE_22_WITH_BLOCKERS`

**Skip until Wave 4:** full `PHASE_22_INPUTS.md` / `FINAL_PHASE_21_REPORT.md` (this file’s `FINAL_READINESS_DECISION.md` is Wave 0 interim CONDITIONAL GO only).

**No application code in Wave 0** beyond Training/Adoption README banners.
