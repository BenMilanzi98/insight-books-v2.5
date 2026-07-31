# Task 1 Review — Phase 19 Wave 1 (Request + Plan spine) — RE-REVIEW after fix wave

**Reviewer:** defect-first gate  
**Date:** 2026-07-31  
**Base / Head:** WORKING_TREE  
**Trigger:** Fix wave for prior Important #1–2 (`task-1-report-p19.md` `## Fix wave`)  
**Brief / report:** `task-1-brief-p19.md` / `task-1-report-p19.md`  
**Spec/Plan:** `docs/superpowers/plans/2026-07-31-customer-adoption-phase-19.md` Task 1 + Global Constraints  
**Vitest:** re-run `npx vitest run test/systemAdmin.cs.adoptionWave1.test.js` → **16/16 PASS**

---

## Fix-wave verification (LIVE)

| Prior Important | Live evidence | Verdict |
|-----------------|---------------|---------|
| #1 Writes-by-id skip portfolio load | `plans.js` `createCustomerAdoptionPlan` gates via `loadAdoptionRequestForActor` before mutate; `handoverAttach.js` uses `loadAdoptionRequestForActor` / `loadAdoptionPlanForActor` on both request and plan paths | ✅ Fixed |
| #2 Training→ADR race uniqueness | SQL partial unique `CustomerAdoptionRequest_trainingProgramId_auto_source_key` (`trainingProgramId` WHERE `source = PHASE_18_TRAINING_COMPLETED`); Prisma comment; `requests.js` race catch recovers via `findFirst({ trainingProgramId, source })` when idempotency keys differ; mock enforces P2002 on auto-source program | ✅ Fixed |
| Tests | `plan create + handover attach deny cross-portfolio writes-by-id`; `Training→ADR race with different idempotency keys recovers same Request` | ✅ Covered |

---

## Spec compliance: ✅

| Brief / global rule | Verdict |
|---------------------|---------|
| Auto Request only Program aggregate `COMPLETED` | ✅ |
| Gaps / partial / non-COMPLETED ≠ auto Request | ✅ |
| Exact consume retry → same ADR; conflict → fail | ✅ |
| Accept → ADP once; one Request → one Plan | ✅ |
| Handover attach ≠ invent Training COMPLETED | ✅ |
| Plan COMPLETED / HANDED_TO_RENEWALS → `COMPLETION_POLICY_REQUIRED` | ✅ |
| List/load fail-closed portfolio | ✅ |
| Writes-by-id portfolio fail-closed | ✅ create-plan + handover attach gated |
| Manage/view authz (no `!admin` bypass) | ✅ |
| Numbering ADR/ADP; template pin | ✅ |
| Training→ADR unique-by-program + race recovery | ✅ |
| Vitest Wave 1 GREEN | ✅ 16/16 |

---

## Strengths

1. Prior gate defects closed without weakening honesty / completion-policy stubs.
2. Portfolio write gates match Training Wave 2/3 `load*ForActor` pattern.
3. Partial unique + program-source race recovery closes concurrent distinct-key double-ADR.
4. Vitest 16/16 includes both fix-wave cases.

---

## Task quality: Approved with notes

### Critical findings

None.

### Important findings

None. Prior Important #1–2 verified fixed live.

### Minor notes (non-blocking)

1. Consume still trusts stored Program `status` (no re-call of `evaluateProgramCompletion`) — acceptable if Training remains source of truth.
2. Audited completion waiver can still reach `COMPLETED` / `HANDED_TO_RENEWALS` in Wave 1 (mirrors Training).
3. Handover attach overwrites a different `onboardingHandoverId` without conflict (same-id replay idempotent).
4. Subscription pin optional on validate (reported; matches brief Customer/Tenant).
5. Prisma generate / db push may still be required for live client; SQL + `hasModel` UNAVAILABLE guards remain.

---

## Verdict

- **Spec compliance:** ✅  
- **Task quality:** Approved with notes  
- **Critical:** 0  
- **Important:** 0  
- **Gate:** Clear for Wave 2 from Task 1 re-review perspective.
