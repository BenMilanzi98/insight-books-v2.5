# Task 1 Review — Phase 18 Wave 1 (Request + Program spine)

**Reviewer:** defect-first gate  
**Date:** 2026-07-31  
**Base / Head:** WORKING_TREE  
**Package:** `.superpowers/sdd/task-1-review-package-p18.diff`  
**Brief / report:** `task-1-brief-p18.md` / `task-1-report-p18.md`  
**Vitest:** re-run `npx vitest run test/systemAdmin.cs.trainingWave1.test.js` → **10/10 PASS**

---

## Spec compliance: ✅

| Brief / global rule | Verdict |
|---------------------|---------|
| TRQ / TRN numbering via catalogue + CrmNumberSeq | ✅ `CRM_NUMBER_PREFIX.TRQ`/`TRN`; `allocateTraining*Number` |
| `consumeTrainingHandoff` → Request; handoff ≠ execute | ✅ Creates TRQ; ack typed `IN_PROGRESS` only; refuses COMPLETED |
| Never fabricate `trainingCompleted` | ✅ Always `false` on consume/create/replay paths |
| Exact retry same key → same row; conflict → fail | ✅ Request + Program hash conflict → `idempotency_conflict` |
| One Request → one Program | ✅ `trainingRequestId` unique; `existingByRequest` + race catch by key **or** request id |
| Curriculum pin required (ACTIVE) | ✅ Missing id fails; ACTIVE checked when curriculum model present; seed helper |
| Invalid status throws | ✅ `assertCanTransition*` → `invalid_status_transition` |
| Missing Customer/Tenant/Subscription fails validate | ✅ `requestMissingPins` |
| Thin API/UI + SQL/Prisma + seed | ✅ Routes, pages, `cs-training-phase18-wave1.sql`, Prisma models |
| WORKING_TREE; no commit required | ✅ Matches report |
| Vitest Wave 1 GREEN | ✅ 10/10 (re-run) |

### Phase 17-class watch

| Risk | Status |
|------|--------|
| Handoff IN_PROGRESS ack skipped on replay | **Absent** — `consumeTrainingHandoff` always calls `acknowledgeTrainingHandoffInProgress` after Request ok (create or replay). Covered by repair test. |
| Request CONVERTED not repaired on program retry | **Absent** — `ensureRequestConvertedToProgram` on `existingByKey`, `existingByRequest`, race catch, and create success. Covered by repair test. |
| Tautology list authz (`!canX && !admin`) | **Absent** — lists require `canView`/`canManage`; `resolveTrainingListScope` + fail-closed empty portfolio; Super Admin unscoped only when `mode === 'all'`. |

---

## Task quality: Approved

### Critical findings

None.

### Important findings

None.

### Minor notes

1. Consume response still defaults `handoffExecutionStatus` to `IN_PROGRESS` when ack returns no handoff payload (`ack?.handoff?.executionStatus || IN_PROGRESS`). Durability is fixed by replay ack; response accuracy if mid-call ack fails is cosmetic (same residual as Phase 17).
2. Review package is a lib+test dump (not full git diff) — omits Prisma/SQL/API/UI/`crm/catalogue.js` TRQ|TRN; present on disk and verified.
3. `allowIncompletePins` documented on consume but unused; pins enforced at validate/accept/program (OK).
4. Prisma generate / db push still required for live client (reported; SQL fallback present).

---

## Verdict

- **Spec compliance:** ✅  
- **Task quality:** Approved  
- **Critical:** none  
- **Important:** none  
- **Gate:** Wave 2 may proceed after controller dispatch.
