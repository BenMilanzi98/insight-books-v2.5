### Task 1: Wave 1 — Request + Program spine, numbering, curricula seed, handoff consume, idempotency

**Files:**
- Create: `lib/admin/customerSuccess/training/` — `catalogue.js`, `numbering.js`, `model.js`, `requests.js`, `programs.js`, `status.js`, `handoffConsume.js`, `curricula.js`, `index.js`
- Create: `scripts/sql/cs-training-phase18-wave1.sql` + Prisma: Request/RequestStatusHistory/Program/ProgramStatusHistory/Curriculum/CurriculumVersion/Module/ModuleVersion (+ seed ACTIVE onboarding curriculum)
- Thin APIs/UI under `app/api/admin/customer-success/training-requests/**`, `training-programs/**`, `app/insightbooks/customer-success/training/**`
- Wire: Phase 16 TRAINING handoff → `consumeTrainingHandoff`; optional Phase 17 coordination link
- Test: `test/systemAdmin.cs.trainingWave1.test.js`

**Interfaces:**
- Produces:
  - `consumeTrainingHandoff({ actorContext, handoffId, idempotencyKey })` → Request `TRQ-`
  - `validateTrainingRequest` / `acceptTrainingRequest` / `rejectTrainingRequest`
  - `createCustomerTrainingProgram({ actorContext, trainingRequestId, curriculumVersionId, ownerAssignments, targetStartDate, targetCompletionDate, idempotencyKey })` → Program `TRN-` with pinned curriculumVersionId
  - `ensureWave1OnboardingCurriculumVersion` — ACTIVE seed
  - Status transition helpers; invalid throws
  - Exact retry same key → same row; conflict → fail; one Request → one Program
  - Handoff acknowledge typed IN_PROGRESS only — never fabricate trainingCompleted

- [ ] **Step 1: Write failing Vitest** — handoff→TRQ; retry same; accept→TRN once; project retry same; conflict fails; invalid transition throws; missing Customer/Tenant/Subscription fails; curriculum pin required
- [ ] **Step 2: Run** `npx vitest run test/systemAdmin.cs.trainingWave1.test.js` — expect FAIL
- [ ] **Step 3: Implement** SQL/Prisma + lib + thin API/UI + model guards
- [ ] **Step 4: Re-run Vitest** — PASS; no Session/attendance yet; no Tenant GL
- [ ] SDD review gate before Wave 2

---
