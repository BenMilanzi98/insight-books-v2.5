# Phase 21 Final Whole-Branch Review — Customer Onboarding (PRD 21)

**Reviewer:** SDD final review subagent (defect-first)  
**Date:** 2026-07-31  
**Base:** `7d9709a897bc0d4609ce8a6725aad7d9cf1cb835` → WORKING_TREE (no commits)  
**Canonical domain:** `lib/admin/customerSuccess/onboarding/**`  
**Claimed exit:** `READY_FOR_PHASE_22_WITH_BLOCKERS`

---

## Verdict

**Approved with notes**

---

## Findings

### Critical (0)

None.

### Important (0)

None. Cross-task honesty must-verify items hold in code, docs, and LIVE Vitest.

### Minor / notes (not blocking)

1. **`progress.js` coarse statusWeights omit `COMPLETED_WITH_GAPS`** — terminal projects without materialised tasks/milestones fall through to `?? 0` (0%) instead of ~98 like `COMPLETED_WITH_OPEN_ITEMS`. Honesty flags still force `complete/isComplete/isReadiness/isAdoption: false` (no fabricated completion). One-line map fix recommended post-exit or early Phase 22 polish.
2. **Design §9 completion surface vs G21-18 brief** — certificate chain enforces go-live + stabilisation + sign-offs + handover + recon (gap register G21-18). Full design list (workstreams/milestones/checklists/tests/Training policy/MRA/integrations) remains broader; tracked as WITH_BLOCKERS residual (Task 3 note), not a failed Wave gap.
3. **Search `findMany` catch** — still `ok: true` + partial/`[]` (CS search pattern; export/DQ/recon use UNAVAILABLE). Task 4 Minor retained.
4. **Thin Overview hub** — PRD 21 copy + honesty keys; no live metric fetch wiring (intentional thin UI / WITH_BLOCKERS).

---

## Cross-task must-verify

| Check | Result |
|-------|--------|
| Tree-17 hardened in place; no parallel SalesOnboarding / second domain | ✅ No `SalesOnboarding*`; domain contract `phase: 21` / `treePhaseAlias: 17` |
| Handoff consume + Project spine honesty (Task 1) | ✅ Checksum UNKNOWN≠VALID; accept → ONR + ACCEPTED_BY_ONBOARDING; never execution COMPLETED / fabricated complete; Project create after accept, idempotent, status machine |
| Readiness honesty (Task 2) | ✅ REQUESTED≠PROVISIONED without provider; ACTIVE from subscription row; invite≠ACCESS_VALID; accounting governed / no Tenant GL / System CoA refuse |
| Go-live / completion / CS handover / Phase 22 Training (Task 3) | ✅ schedule≠SUCCESSFUL≠completion; COMPLETED_WITH_GAPS explicit; no Customer Health overwrite; Training handoff-only (refuse Programs/Sessions/certs) |
| Metrics / DQ / recon fail-closed (Task 4) | ✅ Gate fail → UNAVAILABLE / `value: null`; never invent `lineageIntact: true` / false zeroes; progress≠readiness≠completion≠adoption labels |
| Mislabel map | ✅ tree-18 Training = FUTURE PRD 22; Adoption Phase 20 pack non-authoritative; folders preserved |
| No fabricate completion/attendance/certs/provision/activation; no Tenant GL as SaaS revenue; System CoA removed | ✅ Domain refuses + accounting boundary |
| Do not recommend deleting mislabelled CS folders | ✅ phase-17/18/19 + training/adoption present; exit docs say preserve |

---

## Exit ratification

| Item | Result |
|------|--------|
| Exit claim `READY_FOR_PHASE_22_WITH_BLOCKERS` | **Ratified: yes** |
| Recorded in `FINAL_READINESS_DECISION.md` / pack / reports | ✅ |
| Phase 22 pack honest (Training handoff-only; blockers listed; mislabel pointer) | ✅ |
| Vitest pass claims honest | ✅ LIVE re-run matches |

---

## Vitest (LIVE re-run 2026-07-31)

```text
npx vitest run \
  test/systemAdmin.cs.onboardingPhase21Wave1.test.js \
  test/systemAdmin.cs.onboardingPhase21Wave2.test.js \
  test/systemAdmin.cs.onboardingPhase21Wave3.test.js \
  test/systemAdmin.cs.onboardingPhase21Wave4.test.js \
  test/systemAdmin.cs.onboardingWave1.test.js \
  test/systemAdmin.cs.onboardingWave2.test.js \
  test/systemAdmin.cs.onboardingWave3.test.js \
  test/systemAdmin.cs.onboardingWave4.test.js

 Test Files  8 passed (8)
      Tests  86 passed (86)
```

Task 4 pack subset (P21 W1–4 + tree W4): **5 files / 44 tests PASS**.  
Phase 21-only W1–4: **4 files / 36 tests PASS**.

---

## Counts

| Severity | Count |
|----------|-------|
| Critical | 0 |
| Important | 0 |
| Minor | 4 (notes) |

**Exit ratification:** **yes** — `READY_FOR_PHASE_22_WITH_BLOCKERS`  
**Ready for Phase 22 start under documented blockers:** **yes**
