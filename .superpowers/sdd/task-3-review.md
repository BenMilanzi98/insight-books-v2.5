# Task 3 Re-Review — Phase 17 Wave 3 (after Critical+Important fixes)

**Base:** WORKING_TREE · **Head:** WORKING_TREE · **Package:** `task-3-review-package.diff`  
**Suite:** Wave 1+2+3 → **37/37 passed** (re-run confirmed)

## Verdicts
- **Spec compliance:** ✅
- **Task quality:** Ready (Wave 4 CONDITIONAL GO)

## Must-resolve (prior Critical / Important) — verified fixed

| Finding | Status | Evidence |
|---|---|---|
| Critical: stored READY lifts live UNKNOWN→READY | ✅ Fixed | `evaluate.js` — no snapshot merge; stored audit-only; test `stored READY snapshot never lifts…` |
| Important: training IN_PROGRESS → READY | ✅ Fixed | `evaluateTrainingDim` — IN_PROGRESS/READY without Training-domain COMPLETED → NOT_READY |
| Important: execute/outcome skip readiness | ✅ Fixed | `requireCurrentReadiness` on approve + execute + SUCCESSFUL outcome |
| Important: SUCCESSFUL without STABILISATION | ✅ Fixed | Final status gate + `go_live_stabilisation_transition_failed` |
| Important: ambient tenant journals fail boundary | ✅ Fixed | Fail only onboarding-authored side effects; create-deny retained |

## Critical
None.

## Important
None remaining from the must-resolve set.

## Minor
- `recordGoLiveOutcome(SUCCESSFUL)` may persist go-live row as SUCCESSFUL before STABILISATION is confirmed; failure path returns `ok: false` but row can be ahead of project status.
- Production API does not pass `dimensionOverrides`; live probes for tenant/users/config still need Wave 4 attestation wiring (fail-closed — correct).
- Authored-side-effect detect needs `findMany`; count-only clients cannot flag onboarding-authored rows (ambient still correctly allowed).

## Spec checklist

| Acceptance | Status |
|---|---|
| UNKNOWN ≠ READY; no snapshot lift; blocks go-live | ✅ |
| Training IN_PROGRESS non-READY | ✅ |
| Critical defect blocks approval | ✅ |
| Execute/outcome re-check readiness | ✅ |
| Successful go-live → STABILISATION (required) | ✅ |
| Migration COMPLETED needs recon | ✅ |
| Training COMPLETED needs Training-domain source | ✅ |
| Completion needs sign-offs / recon / handover | ✅ |
| Certificate checksum + idempotent retry | ✅ |
| Accounting: no onboarding creates; ambient GL OK | ✅ |
| Cross-Tenant project access denied | ✅ |
| Progress/health server-side, versioned | ✅ |
| Vitest Wave 1–3 green | ✅ 37/37 |

## Overall
Prior Critical + Important findings are resolved with targeted tests. Readiness honesty holds; go-live success requires STABILISATION; accounting boundary is create/onboarding-authored only. **Ready for Wave 4 CONDITIONAL GO.**
