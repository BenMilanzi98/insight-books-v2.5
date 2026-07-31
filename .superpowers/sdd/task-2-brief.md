### Task 2: Wave 2 — Templates, materialisation, kick-off (Phase 13), stakeholders, tasks/evidence, scope/CR

**Files:**
- Create: `templates.js`, `templateVersions.js`, `materialise.js`, `kickoff.js`, `stakeholders.js`, `requirements.js`, `scope.js`, `changeRequests.js`, `workstreams.js`, `milestones.js`, `tasks.js`, `evidence.js`, `responsibilities.js`, `dependencies.js`
- Create: `scripts/sql/cs-onboarding-phase17-wave2.sql` + Prisma for Template/Version/Workstream/Milestone/Task/Checklist/Stakeholder/Kickoff/Requirement/ScopeItem/Responsibility/ChangeRequest/TaskDependency (+ evidence attestation fields)
- Wire: `lib/admin/crm/meetings` for kick-off Meeting create/link
- Test: `test/systemAdmin.cs.onboardingWave2.test.js`

**Interfaces:**
- Produces:
  - Template version approve/activate; active version immutable
  - `materialiseOnboardingTemplate({ projectId, templateVersionId, idempotencyKey })` — Workstreams/Milestones/Tasks/Checklists once
  - `scheduleOnboardingKickoff({ projectId, meetingInput, idempotencyKey })` → `crmMeetingId`; RSVP vs attendance fields distinct
  - Stakeholder assign with Contact verification gate
  - `confirmOnboardingRequirements` / `detectScopeMismatch` → Change Request when mismatch
  - Task create/assign; `submitCustomerTaskEvidence({ taskId, actorContext, attestationReason, contactId, fileRef })`; `reviewCustomerTaskEvidence` approve/reject
  - Customer Task complete blocked without evidence source or authorised waiver
  - Dependency cycle detection

- [ ] **Step 1: Write failing Vitest** — materialise once on retry; kick-off creates/links Meeting once; RSVP accepted ≠ attendance; Customer Task cannot complete without evidence; evidence reject retains reason; scope mismatch creates CR and does not mutate Subscription entitlements; circular dependency rejected; Meeting unavailable → typed fail (mock)
- [ ] **Step 2: Run Vitest** — expect FAIL
- [ ] **Step 3: Implement** lib + SQL + thin UI tabs (kick-off, tasks, stakeholders, requirements)
- [ ] **Step 4: Re-run Vitest** — PASS
- [ ] SDD review gate before Wave 3

---
