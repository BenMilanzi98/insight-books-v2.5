# Task 1 Report — Phase 18 Wave 1 (Request + Program spine)

**Date:** 2026-07-31  
**Status:** COMPLETE (GREEN)  
**Commit:** none (per brief)

---

## Summary

Implemented Phase 18 Wave 1 Customer Training Request (`TRQ-`) + Program (`TRN-`) spine under `lib/admin/customerSuccess/training/**`, with ACTIVE onboarding curriculum seed, Phase 16 TRAINING handoff consume (IN_PROGRESS ack only), SQL + Prisma models, thin APIs/UI, and Vitest coverage.

---

## RED

```text
npx vitest run test/systemAdmin.cs.trainingWave1.test.js

 FAIL  test/systemAdmin.cs.trainingWave1.test.js
Error: Cannot find package '@/lib/admin/customerSuccess/training'
 Test Files  1 failed (1)
      Tests  no tests
```

Failure mode: missing domain package (expected before implementation).

---

## GREEN

```text
npx vitest run test/systemAdmin.cs.trainingWave1.test.js

 Test Files  1 passed (1)
      Tests  10 passed (10)
 Duration  ~1.13s
```

| Case | Result |
|------|--------|
| TRAINING handoff ? one TRQ Request + handoff IN_PROGRESS | PASS |
| Exact handoff retry ? same Request | PASS |
| Replay repairs stuck NOT_STARTED ? IN_PROGRESS; never COMPLETED | PASS |
| Accept ? one TRN Program; one Request ? one Program | PASS |
| Exact program retry ? same Program | PASS |
| Retry repairs Request ? CONVERTED_TO_PROGRAM | PASS |
| Conflicting idempotency payload fails | PASS |
| Invalid status transition throws | PASS |
| Missing Customer/Tenant/Subscription fails validation | PASS |
| curriculumVersionId pin required | PASS |

---

## Deliverables

| Area | Path |
|------|------|
| Domain | `lib/admin/customerSuccess/training/{catalogue,numbering,model,status,requests,programs,handoffConsume,curricula,listScope,index}.js` |
| SQL | `scripts/sql/cs-training-phase18-wave1.sql` |
| Prisma | `CustomerTraining{Request,RequestStatusHistory,Program,ProgramStatusHistory,Curriculum,CurriculumVersion,Module,ModuleVersion}` |
| Prefixes | `CRM_NUMBER_PREFIX.TRQ` / `TRN` in `lib/admin/crm/catalogue.js` |
| API | `app/api/admin/customer-success/training-requests/route.js`, `training-programs/route.js` |
| UI | `app/insightbooks/customer-success/training/{page,requests/page,programs/page}.js` |
| Test | `test/systemAdmin.cs.trainingWave1.test.js` |

### Interfaces shipped

- `consumeTrainingHandoff` ? `TRQ-YYYY-######`; ack handoff `IN_PROGRESS` only; `trainingCompleted: false` always
- `validateTrainingRequest` / `acceptTrainingRequest` / `rejectTrainingRequest`
- `createCustomerTrainingProgram` ? `TRN-YYYY-######` with pinned `curriculumVersionId`
- `ensureWave1OnboardingCurriculumVersion` — ACTIVE `CUSTOMER_ONBOARDING_WAVE1`
- Status helpers; invalid transitions throw `invalid_status_transition`
- Exact retry / conflict / one Request ? one Program

---

## Out of scope (correctly deferred)

- Sessions, attendance, assessments, certificates (Wave 2–3)
- Tenant GL / Subscription / entitlement mutations
- Fabricated trainingCompleted / handoff COMPLETED

---

## Concerns / follow-ups

1. **Prisma client generate / db push not run** — schema + SQL fallback present; live DB needs `db push`/`generate` (or SQL apply) before production APIs hit real Prisma client.
2. **UI/API are thin stubs** — list/action routes wired; no rich Request/Program detail UX yet.
3. **`listScope.js`** added beyond brief file list (mirrors Phase 17) for fail-closed portfolio lists.
4. **SDD review gate** before Wave 2.

---

## Verification commands

```bash
npx vitest run test/systemAdmin.cs.trainingWave1.test.js
```
