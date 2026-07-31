# Task 4 Review — Phase 17 Wave 4 (re-review: Important fix wave)

**Mode:** Spec + quality (read-only)  
**Head:** `WORKING_TREE` (no commit, per brief)  
**Brief / report:** `task-4-brief.md` / `task-4-report.md` (Fix wave)  
**Date:** 2026-07-31  
**Vitest:** Wave 1 + Wave 4 **16/16 passed** (re-run this review)

---

### Spec Compliance: ✅

| Criterion | Status | Notes |
|-----------|--------|-------|
| Gate fail → UNAVAILABLE / `value: null` | ✅ | Unchanged; honesty held |
| My Work excludes other owners | ✅ | Create now pins `csOwnerAdminId` / `ownerAdminId` via `resolveOwnerPins` |
| Search excludes inaccessible ONB | ✅ | Fail-closed on omit/empty scope for scoped actors; Super Admin `mode=all` only |
| Export strips credentials + recheck | ✅ | Unchanged |
| Phase 8 link / UNKNOWN; never invent COMPLETED | ✅ | Broken link → `UNKNOWN` + `linkBroken`; `completedAt` null |
| Exit + Phase 18 pack + EN/NY + cert idempotent | ✅ | Unchanged |

---

### Task quality: **Approved**

---

### Critical
None.

### Important
None remaining (prior three resolved):

1. **Owner pins on create** — `createOnboardingProject` persists `csOwnerAdminId` / `ownerAdminId` from assignments (+ aliases / actor fallback). Wave 1 asserts store + serialized pins.
2. **Search fail-closed** — empty/omitted `portfolioTenantIds` for scoped CS → `[]` + `failClosed`; resolves via `resolveCsPortfolioScope`; never unfiltered fleet.
3. **Broken Phase 8 link ≠ legacy COMPLETED** — `serializeRow` sets `linkBroken`, status `UNKNOWN` (or explicit mig), never historical `COMPLETED`.

### Minor (carry, non-blocking)
- Pre-fix-wave rows without column pins still miss My Work until backfill (create path fixed).
- Overview / export / DQ counts remain global (no portfolio filter).
- `xlsx` export stub returns JSON body.

---

### Overall
Fix wave closes the three Important gaps. Wave 4 is **Approved** for Spec + quality; exit readiness unchanged: `READY_FOR_PHASE_18_WITH_BLOCKERS`.
