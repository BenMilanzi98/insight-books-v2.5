### Task 1: Wave 1 — Request + Plan spine, numbering, Training consume, manual, handover attach, status policy

**Files:**
- Create: `lib/admin/customerSuccess/adoption/` — `catalogue.js`, `numbering.js`, `model.js`, `requests.js`, `plans.js`, `status.js`, `trainingConsume.js`, `handoverAttach.js`, `listScope.js`, `planAccess.js`, `permissions.js`, `index.js`
- Create: `scripts/sql/cs-adoption-phase19-wave1.sql` + Prisma: Request/RequestStatusHistory/Plan/PlanStatusHistory/PlanTemplate/PlanTemplateVersion (+ seed ACTIVE default template)
- Thin APIs/UI under `app/api/admin/customer-success/adoption-requests/**`, `adoption-plans/**`, `app/insightbooks/customer-success/adoption/**`
- Test: `test/systemAdmin.cs.adoptionWave1.test.js`

**Interfaces:**
- Produces:
  - `consumeTrainingCompletionForAdoption({ actorContext, programId, idempotencyKey })` → Request `ADR-` only when Program aggregate status is `COMPLETED`
  - Reject auto-create for `COMPLETED_WITH_GAPS` / `IN_PROGRESS` / partial participant counts
  - `createManualAdoptionRequest` / `validateAdoptionRequest` / `acceptAdoptionRequest` / `rejectAdoptionRequest`
  - `attachOnboardingHandoverToAdoption({ actorContext, handoverId, requestId|planId, idempotencyKey })` — attach only; never sets Training COMPLETED
  - `createCustomerAdoptionPlan({ actorContext, adoptionRequestId, planTemplateVersionId, ownerAssignments, idempotencyKey })` → Plan `ADP-` with pinned templateVersionId
  - Status transitions; `COMPLETED` / `HANDED_TO_RENEWALS` blocked until Wave 2/3 evaluation hooks exist (or throw `COMPLETION_POLICY_REQUIRED`)
  - Exact retry same key → same row; conflict → fail; one Request → one Plan
  - `resolveAdoptionListScope` / `loadAdoptionPlanForActor` / `loadAdoptionRequestForActor` fail-closed portfolio

- [ ] **Step 1: Write failing Vitest** — Training COMPLETED→ADR; retry same; WITH_GAPS no Request; accept→ADP once; plan retry same; conflict fails; invalid transition throws; missing Customer/Tenant fails; template pin required; portfolio empty list `[]`; cross-tenant plan load denied
- [ ] **Step 2: Run** `npx vitest run test/systemAdmin.cs.adoptionWave1.test.js` — expect FAIL
- [ ] **Step 3: Implement** SQL/Prisma + lib + thin API/UI + model guards
- [ ] **Step 4: Re-run Vitest** — PASS; no milestones/value yet; no Tenant GL
- [ ] SDD review gate before Wave 2

---
