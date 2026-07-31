# Phase 17 Final Form Report — Critical + Important Remediation

**Date:** 2026-07-31  
**Workspace:** `c:\laragon\www\insight-books-v2.5`  
**Trigger:** Fix Critical + Important findings from `phase17-final-review.md`  
**Git commit:** none (per instruction)

---

## Remediation summary

| ID | Finding | Status |
|----|---------|--------|
| **C1** | List APIs bypass CS authz / unscoped fleet | **FIXED** — `listOnboardingProjects` / `listOnboardingRequests` require `canView`/`canManage`; portfolio scope via `resolveOnboardingListScope`; fail-closed empty scope |
| **C2** | Completion certificate without go-live/stabilisation | **FIXED** — evaluation + certificate require successful go-live + stabilisation EXITED (type-policy waive only with audited approval); removed `requireGoLive: false` skip |
| **I1** | Metrics/overview global counts | **FIXED** — portfolio-scoped; empty/fail → `UNAVAILABLE` / `value: null` |
| **I2** | Migration READY without recon | **FIXED** — `READY` / `READY_FOR_IMPORT` / `COMPLETED` require recon for readiness + setStatus gate |
| **I3** | Phase 8 migrate view-mutate / first-project link | **FIXED** — manage-only; unique explicit tenant(+customer) match; ambiguous → UNKNOWN |
| **I4** | Project get-by-id not portfolio-scoped | **FIXED** — `loadOnboardingProjectForActor` enforces portfolio scope |
| **I5** | `executeGoLive` duplicate executions | **FIXED** — idempotencyKey required; exact retry + existing in-progress/completed returns same row |

---

## Vitest

```
npx vitest run test/systemAdmin.cs.onboardingWave1.test.js \
  test/systemAdmin.cs.onboardingWave2.test.js \
  test/systemAdmin.cs.onboardingWave3.test.js \
  test/systemAdmin.cs.onboardingWave4.test.js
```

| Result | Count |
|--------|-------|
| Test files | **4 passed** |
| Tests | **50 passed** (was 44 claimed) |
| Exit code | **0** |
| Duration | ~4.55s |

New / extended coverage includes: list unauthorized + scoped denial; certificate blocks without go-live/stabilisation; migration READY without recon; executeGoLive idempotent retry; project ID portfolio scope; metrics portfolio scope; Phase 8 manage-only + ambiguous UNKNOWN; Wave 4 cert includes stabilisation EXITED.

---

## Exit readiness note

Prior exit docs claimed `READY_FOR_PHASE_18_WITH_BLOCKERS`. After Critical (C1/C2) + Important (I1–I5) remediation and green Vitest **50/50**, that claim is again supportable **with the already-documented optional blockers** (portal, migration engine, Training execution, MRA fiscal, payment/e-sign).

Controller may update `FINAL_READINESS_DECISION.md` / ledger accordingly. Review verdict `NOT_READY_FOR_PHASE_18` is superseded for Criticals; remaining known gaps are Minor carry items (M1–M5) and documented Phase 18 blockers — not Critical authz/false-completion holes.

---

## Files changed (remediation pass)

- `lib/admin/customerSuccess/onboarding/listScope.js` (new)
- `lib/admin/customerSuccess/onboarding/projects.js`
- `lib/admin/customerSuccess/onboarding/requests.js`
- `lib/admin/customerSuccess/onboarding/completion.js`
- `lib/admin/customerSuccess/onboarding/projectAccess.js`
- `lib/admin/customerSuccess/onboarding/metrics.js`
- `lib/admin/customerSuccess/onboarding/readiness/evaluate.js`
- `lib/admin/customerSuccess/onboarding/migration.js`
- `lib/admin/customerSuccess/onboarding/phase8Migrate.js`
- `lib/admin/customerSuccess/onboarding/goLive.js`
- `lib/admin/customerSuccess/onboarding/index.js`
- `test/systemAdmin.cs.onboardingWave1.test.js`
- `test/systemAdmin.cs.onboardingWave3.test.js`
- `test/systemAdmin.cs.onboardingWave4.test.js`

---

## Remaining known gaps (non-Critical)

- **M1** Wave 2 template SoD soft only  
- **M2** Thin Overview UI does not live-call metrics API  
- **M3** Prisma EPERM → SQL fallback operational dependency  
- **M4** customerApproval / internalApproval dims excluded from CORE_DIMENSIONS rollup  
- **M5** `approveGoLive` no idempotency (duplicate APPROVED rows possible)  
- Documented Phase 18 blockers: portal, migration engine, Training execution, MRA fiscal, payment/e-sign  
