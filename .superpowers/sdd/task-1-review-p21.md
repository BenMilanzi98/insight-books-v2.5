# Task 1 Review — Phase 21 Wave 1 Handoff validate/accept + Project spine

**Reviewer:** SDD review subagent  
**Date:** 2026-07-31  
**Mode:** READ-ONLY (this review file only)  
**Scope (LIVE):** `lib/admin/customerSuccess/onboarding/{handoffConsume,projects,projectAccess,catalogue,status,templates,index}.js`; `test/systemAdmin.cs.onboardingPhase21Wave1.test.js`  
**Vitest (LIVE):** `npx vitest run test/systemAdmin.cs.onboardingPhase21Wave1.test.js test/systemAdmin.cs.onboardingWave1.test.js` → **20/20 PASS** (Wave1 10/10 + regression 10/10)

## Focus checklist (LIVE)

| Focus | Result |
|-------|--------|
| Checksum validate | **PASS** — `evaluateOnboardingHandoffChecksum` + `validateOnboardingHandoff`; emit SoT `computeOnboardingHandoffChecksum`; missing → UNKNOWN; mismatch → INVALID |
| UNKNOWN ≠ VALID | **PASS** — missing/blank checksum never VALID; accept refuses UNKNOWN and does not mark `ACCEPTED_BY_ONBOARDING` |
| Accept idempotent | **PASS** — exact retry same Request; same key + different handoff → `idempotency_conflict`; SUPERSEDED refused; history preserved |
| Project after accept | **PASS** — accept sets `projectCreated: false`; create after Request ACCEPTED; `ONB-` number; ACTIVE template pin |
| One-active | **PASS** — `active_project_exists` on accept + create (handoff / customer+tenant, terminal exclusions) |
| Portfolio fail-closed | **PASS** — `assertOnboardingTenantInPortfolioScope` on accept/create-by-id; empty/`tenant-other` denied for scoped CS |
| Invalid transitions | **PASS** — DRAFT→COMPLETED, PLANNING→COMPLETED/LIVE throw `invalid_status_transition` |

## Issues

### Critical

None.

### Important

None.

### Minor

1. **Accept `acceptInputHash` stored but not compared on same-key replay** — `projects.js` conflicts on `inputHash` mismatch; accept treats same key + same handoff as exact retry even if `acceptanceNotes` differ. Spec/G21-02 only requires exact retry + conflicting **key**; deepen optional.
2. **Portfolio gate skips when `tenantId` blank** — `assertOnboardingTenantInPortfolioScope` only denies when `tid` truthy and out of scope; blank tid falls through then fails pin validation. Prefer deny when `tenantScope` set and tid missing (defense-in-depth).
3. **G21-06 materialise-once** — Wave 1 proves ACTIVE/immutable template pin; materialise-once remains Wave 1–2 per gap register (non-blocking for this gate).

## Assessment

**Approved with notes**

All LIVE focus checks pass; Wave 1 + regression Vitest green. No Critical/Important defects. Residual items are Minor / optional deepen. SDD review gate clear for Wave 2.
