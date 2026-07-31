# Task 2 Re-Review — Phase 18 Wave 2 (after Critical+Important fix wave)

**Reviewer:** defect-first gate (re-review)  
**Date:** 2026-07-31  
**Base / Head:** WORKING_TREE  
**Prior review:** Critical 1 + Important 2 → Changes required  
**Brief / report:** `task-2-brief-p18.md` / `task-2-report-p18.md` (Fix wave)  
**Vitest:** `npx vitest run test/systemAdmin.cs.trainingWave1.test.js test/systemAdmin.cs.trainingWave2.test.js` → **22/22 PASS**

---

## Spec compliance: ✅

| Brief / fix-wave rule | Verdict |
|-----------------------|---------|
| Participant verify/enrol; duplicate identity | ✅ |
| UNKNOWN denied RESTRICTED materials | ✅ |
| Trainer skill/language + overlap | ✅ |
| Cohort + `scheduleTrainingSession` → `crmMeetingId` | ✅ Meeting once; unavailable typed; no fabricated delivery |
| RSVP ≠ attendance; forbidden sources | ✅ |
| Correction preserves original | ✅ |
| BLOCKED/UNKNOWN ≠ confirmable as NO_CONFLICT | ✅ Server re-eval on confirm; spoof rejected |
| Confirm never trusts client `conflictState` / `forceUnknown` | ✅ `confirmTrainingSchedule` always calls `evaluateTrainingConflicts` without those args |
| Session idempotency: program + cohort + schedule | ✅ `assertSessionIdempotencyMatch` → `idempotency_conflict` |
| Session create race catch → replay / conflict | ✅ try/catch on `create`; load by `idempotencyKey` |
| Virtual / env isolation | ✅ |
| Vitest Wave 1+2 GREEN | ✅ 22/22 |

### Must-resolve closure

| Prior finding | Status |
|---------------|--------|
| Critical — confirm trusts client `conflictState` | **Resolved** — re-eval only; API `…body` spoof ignored; BLOCKED/UNKNOWN/APPROVAL_REQUIRED blocked |
| Important — Session create race catch | **Resolved** — unique failure → exact replay or `idempotency_conflict` |
| Important — idempotency only checked `programId` | **Resolved** — also `cohortId`, `timezone`, `startsAt`, `endsAt` |

---

## Task quality: Approved

### Critical findings

None.

### Important findings

None.

### Residual notes (non-blocking)

1. `evaluate-conflicts` still accepts body `forceUnknown` (fail-closed toward UNKNOWN; confirm path strips it). Keep test-only or drop from public evaluate if Wave 3 hardens the API.
2. Attendance rejects forbidden sources but does not allowlist known-good sources.
3. Prisma generate / db push still required for live client (reported).
4. Thin API/UI stubs remain in scope for Wave 2.

---

## Verdict

- **Spec compliance:** ✅  
- **Task quality:** Approved  
- **Critical remaining:** 0  
- **Important remaining:** 0  
- **Gate:** Clear for Wave 3 on Task 2 conflict/idempotency invariants.
