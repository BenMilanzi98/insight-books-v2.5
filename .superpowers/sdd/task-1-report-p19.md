# Task 1 Report — Phase 19 Wave 1 (Request + Plan spine)

**Date:** 2026-07-31  
**Status:** COMPLETE (GREEN)  
**Commit:** none (WORKING_TREE only, per brief)

---

## Summary

Implemented Phase 19 Wave 1 Customer Adoption Request (`ADR-`) + Plan (`ADP-`) spine under `lib/admin/customerSuccess/adoption/**`, with ACTIVE default plan template seed, Training Program COMPLETED consume (gaps/partial rejected), onboarding handover attach (never invents Training COMPLETED), SQL + Prisma models, thin APIs/UI, and Vitest coverage.

---

## RED

```text
npx vitest run test/systemAdmin.cs.adoptionWave1.test.js

 FAIL  test/systemAdmin.cs.adoptionWave1.test.js
Error: Cannot find package '@/lib/admin/customerSuccess/adoption'
 Test Files  1 failed (1)
      Tests  no tests
```

Failure mode: missing domain package (expected before implementation).

---

## GREEN

```text
npx vitest run test/systemAdmin.cs.adoptionWave1.test.js

 Test Files  1 passed (1)
      Tests  14 passed (14)
 Duration  ~1.11s
```

| Case | Result |
|------|--------|
| Training COMPLETED → one ADR Request | PASS |
| Exact Training COMPLETED retry → same Request | PASS |
| COMPLETED_WITH_GAPS → no Request | PASS |
| IN_PROGRESS → no Request | PASS |
| Accept → one ADP Plan; one Request → one Plan | PASS |
| Exact plan retry → same Plan | PASS |
| Conflicting idempotency payload fails | PASS |
| Invalid request status transition throws | PASS |
| Missing Customer/Tenant fails validation | PASS |
| planTemplateVersionId pin required | PASS |
| COMPLETED / HANDED_TO_RENEWALS → COMPLETION_POLICY_REQUIRED | PASS |
| Handover attach ≠ invent Training COMPLETED | PASS |
| Portfolio empty list → `[]` fail-closed | PASS |
| Cross-tenant plan load denied | PASS |

---

## Deliverables

| Area | Path |
|------|------|
| Domain | `lib/admin/customerSuccess/adoption/{catalogue,numbering,model,status,requests,plans,trainingConsume,handoverAttach,listScope,planAccess,permissions,index}.js` |
| SQL | `scripts/sql/cs-adoption-phase19-wave1.sql` |
| Prisma | `CustomerAdoption{Request,RequestStatusHistory,Plan,PlanStatusHistory,PlanTemplate,PlanTemplateVersion}` |
| Prefixes | `CRM_NUMBER_PREFIX.ADR` / `ADP` in `lib/admin/crm/catalogue.js` |
| API | `app/api/admin/customer-success/adoption-requests/route.js`, `adoption-plans/route.js` |
| UI | `app/insightbooks/customer-success/adoption/{page,requests/page,plans/page}.js` |
| Test | `test/systemAdmin.cs.adoptionWave1.test.js` |

### Interfaces shipped

- `consumeTrainingCompletionForAdoption` → `ADR-YYYY-######` only when Program aggregate `COMPLETED`
- Reject auto-create for `COMPLETED_WITH_GAPS` / `IN_PROGRESS`
- `createManualAdoptionRequest` / `validateAdoptionRequest` / `acceptAdoptionRequest` / `rejectAdoptionRequest`
- `attachOnboardingHandoverToAdoption` — attach only; `trainingCompleted` / `fabricatedTrainingCompleted` never true
- `createCustomerAdoptionPlan` → `ADP-YYYY-######` with pinned `planTemplateVersionId`
- `ensureWave1DefaultPlanTemplateVersion` — ACTIVE `CUSTOMER_ADOPTION_DEFAULT_WAVE1`
- Status helpers; `COMPLETED` / `HANDED_TO_RENEWALS` → `COMPLETION_POLICY_REQUIRED` until Wave 2/3 evaluation
- Exact retry / conflict / one Request → one Plan
- `resolveAdoptionListScope` / `loadAdoptionPlanForActor` / `loadAdoptionRequestForActor` fail-closed portfolio

---

## Out of scope (correctly deferred)

- Milestones, value outcomes, evidence snapshots (Wave 2)
- Champions, dormancy, expansion handoffs (Wave 3)
- Hub polish, metrics/DQ/recon/lineage, Phase 8 projection (Wave 4)
- Tenant GL / renewals billing execute

---

## Concerns

1. **Prisma generate / db push** may hit Windows EPERM — use `scripts/sql/cs-adoption-phase19-wave1.sql` + `hasModel` guards (already fail closed to UNAVAILABLE).
2. **Completion evaluation** is a Wave 1 stub returning `COMPLETION_POLICY_REQUIRED`; Wave 2 must implement real `evaluateAdoptionPlanCompletion` before COMPLETED is reachable without audited waiver.
3. **Subscription pin** is stored when present but Wave 1 validation requires only Customer + Tenant (Training Wave 1 also required Subscription — Adoption brief said “missing Customer/Tenant”; subscription remains optional on validate).
4. SDD review gate before Wave 2.

---

## Fix wave

**Date:** 2026-07-31  
**Trigger:** Task 1 review Important findings (#1–2)  
**No git commit**

### Fixes

| Finding | Change |
|---------|--------|
| Important: writes-by-id skip portfolio load | `createCustomerAdoptionPlan` and `attachOnboardingHandoverToAdoption` gate via `loadAdoptionRequestForActor` / `loadAdoptionPlanForActor` before mutate (same pattern as Training Wave 2/3 writes) |
| Important: Training→ADR concurrency uniqueness | SQL partial unique `CustomerAdoptionRequest_trainingProgramId_auto_source_key` (`trainingProgramId` WHERE `source = PHASE_18_TRAINING_COMPLETED`); Prisma comment; race catch recovers via `findFirst({ trainingProgramId, source })` when idempotency keys differ |

### Tests added / extended

- Plan create + handover attach deny cross-portfolio writes-by-id
- Training→ADR race with different idempotency keys recovers same Request

### Command output

```text
$ npx vitest run test/systemAdmin.cs.adoptionWave1.test.js

 RUN  v4.1.2 C:/laragon/www/insight-books-v2.5

 Test Files  1 passed (1)
      Tests  16 passed (16)
 Duration  ~841ms
```
