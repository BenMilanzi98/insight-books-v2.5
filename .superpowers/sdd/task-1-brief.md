### Task 1: Wave 1 — Request + Project spine, numbering, state machines, handoff consume, idempotency

**Files:**
- Create: `lib/admin/customerSuccess/onboarding/` — `catalogue.js`, `numbering.js`, `model.js`, `requests.js`, `projects.js`, `status.js`, `handoffConsume.js`, `index.js`
- Create: `scripts/sql/cs-onboarding-phase17-wave1.sql` + Prisma models: `CustomerOnboardingRequest`, `CustomerOnboardingRequestStatusHistory`, `CustomerOnboardingProject`, `CustomerOnboardingProjectStatusHistory` (+ type catalogue seed table or const catalogue)
- Create: thin APIs under `app/api/admin/customer-success/onboarding-requests/**`, `onboarding/**` and thin pages under `app/insightbooks/customer-success/onboarding/**` (list/detail stubs OK)
- Wire: Phase 16 ONBOARDING handoff → `consumeOnboardingHandoff` (auto Request)
- Test: `test/systemAdmin.cs.onboardingWave1.test.js`

**Interfaces:**
- Consumes: Phase 16 handoff row (`CrmConversionDomainHandoff` type ONBOARDING), Customer/Tenant/Subscription ids from handoff payload
- Produces:
  - `consumeOnboardingHandoff({ actorContext, handoffId, idempotencyKey })` → Request
  - `validateOnboardingRequest` / `acceptOnboardingRequest` / `rejectOnboardingRequest`
  - `createOnboardingProject({ actorContext, onboardingRequestId, onboardingTemplateVersionId, targetKickoffDate, targetGoLiveDate, ownerAssignments, idempotencyKey })` — Wave 1 may accept `templateVersionId: null` only when status stays pre-materialisation OR use a minimal seeded DRAFT template stub; **prefer requiring a Wave-1 seeded STANDARD template version** so Project always pins `templateVersionId`
  - Numbers: `ONR-YYYY-######`, `ONB-YYYY-######`
  - Status transition helpers with immutable history; invalid transition throws
  - Exact retry same idempotency key → same Request/Project; conflicting payload → visible error
  - One Request → at most one Project (`CONVERTED_TO_PROJECT`)

- [ ] **Step 1: Write failing Vitest** covering:
  - Phase 16 handoff consume creates one `ONR-` Request
  - Exact handoff retry returns same Request (no duplicate)
  - Accept → convert creates one `ONB-` Project; second convert fails or returns same
  - Exact project create retry returns same Project
  - Conflicting idempotency payload fails
  - Invalid status transition rejected
  - Request without Customer/Tenant/Subscription fails validation
- [ ] **Step 2: Run** `npx vitest run test/systemAdmin.cs.onboardingWave1.test.js` — expect FAIL
- [ ] **Step 3: Implement** SQL/Prisma + lib + thin API/UI + model guards; seed minimal ACTIVE STANDARD template version if required for Project pin
- [ ] **Step 4: Re-run Vitest** — PASS; no Workstream materialisation beyond stub if deferred to Wave 2; no Tenant GL; handoff `executionStatus` may move to `IN_PROGRESS`/`ACKNOWLEDGED` only via typed update — never fabricate onboarding complete
- [ ] SDD review gate before Wave 2

---
