# Task 2 Report � Phase 17 Wave 2 (Templates, materialisation, kick-off, evidence, scope/CR)

**Status:** DONE  
**Date:** 2026-07-31  
**Working tree:** branch `v2`, in-place (**no git commit**)  
**Domain path:** `lib/admin/customerSuccess/onboarding/**` (extended Wave 1; no second domain)

## Summary

Wave 2 ships versioned template approve/activate (ACTIVE immutable), idempotent materialisation of Workstreams/Milestones/Tasks/Checklists, Phase 13 kick-off Meeting create/link (RSVP ? attendance; Meeting unavailable ? `MEETING_SERVICE_UNAVAILABLE`), stakeholder Contact verification gate, Customer task evidence via admin attestation (`CUSTOMER_PORTAL_NOT_CONFIGURED`), scope mismatch ? Change Request without Subscription entitlement mutation, and circular dependency rejection. Thin project tabs + API actions. Vitest Wave 1 + Wave 2 green. No Tenant GL / fabricated kick-off complete / Training complete.

## TDD evidence

### RED

```text
$ npx vitest run test/systemAdmin.cs.onboardingWave2.test.js

 FAIL  test/systemAdmin.cs.onboardingWave2.test.js (10 tests | 10 failed)
 TypeError: materialiseOnboardingTemplate is not a function
 TypeError: scheduleOnboardingKickoff is not a function
 � (approve / evidence / scope / dependency / stakeholder likewise missing)
```

Failure reason: Wave 2 exports/modules not implemented (expected before GREEN).

### GREEN

```text
$ npx vitest run test/systemAdmin.cs.onboardingWave2.test.js

 Test Files  1 passed (1)
      Tests  10 passed (10)
```

### Regression (Wave 1 + Wave 2)

```text
$ npx vitest run test/systemAdmin.cs.onboardingWave1.test.js test/systemAdmin.cs.onboardingWave2.test.js

 Test Files  2 passed (2)
      Tests  19 passed (19)
```

### Cases covered

| Case | Result |
|------|--------|
| Materialise once on exact retry (no duplicate WS/MS/Tasks/Checklists) | PASS |
| Kick-off creates/links Phase 13 Meeting once | PASS |
| RSVP accepted ? attendance; kickoffCompleted not set from RSVP | PASS |
| Customer Task cannot complete without evidence/waiver | PASS |
| Evidence reject retains reason; portal `CUSTOMER_PORTAL_NOT_CONFIGURED` | PASS |
| Scope mismatch ? CR; Subscription entitlements unchanged | PASS |
| Circular task dependency rejected | PASS |
| Meeting unavailable ? `MEETING_SERVICE_UNAVAILABLE` | PASS |
| ACTIVE template version immutable (content change rejected) | PASS |
| Stakeholder assign requires verified Contact | PASS |

## Deliverables

### Lib (`lib/admin/customerSuccess/onboarding/`)

| File | Role |
|------|------|
| `catalogue.js` | Wave 2 contract + task/evidence/CR constants; `CUSTOMER_PORTAL_NOT_CONFIGURED`, `MEETING_SERVICE_UNAVAILABLE` |
| `templateVersions.js` | `approveOnboardingTemplateVersion` / `activateOnboardingTemplateVersion` |
| `materialise.js` | `materialiseOnboardingTemplate` (once per project / idempotency key) |
| `kickoff.js` | `scheduleOnboardingKickoff` / `recordOnboardingKickoffRsvp` (injectable `meetingService`) |
| `stakeholders.js` | `assignOnboardingStakeholder` + `CONTACT_NOT_VERIFIED` gate |
| `requirements.js` | `confirmOnboardingRequirements` |
| `scope.js` | `detectScopeMismatch` |
| `changeRequests.js` | `createOnboardingChangeRequest` (`subscriptionMutated: false`) |
| `workstreams.js` / `milestones.js` | list helpers |
| `tasks.js` | `createOnboardingTask` / `completeOnboardingTask` (evidence/waiver gate) |
| `evidence.js` | `submitCustomerTaskEvidence` / `reviewCustomerTaskEvidence` |
| `dependencies.js` | `addOnboardingTaskDependency` + cycle detection |
| `responsibilities.js` | `assignOnboardingResponsibility` |
| `model.js` | Wave 2 `hasCustomerOnboarding*Model` guards + serializers |
| `index.js` | public exports |
| `templates.js` | Wave 1 seed retained |

### Prisma / SQL

- Models appended to `prisma/schema.prisma` (Template, Materialisation, Workstream, Milestone, Task, Checklist, Kickoff, Stakeholder, Requirement, ScopeItem, ChangeRequest, TaskEvidence, TaskDependency, Responsibility; TemplateVersion approve/activate columns)
- SQL fallback: `scripts/sql/cs-onboarding-phase17-wave2.sql`

### Thin API / UI

- `app/api/admin/customer-success/onboarding/route.js` � Wave 2 POST actions (materialise, kickoff, stakeholder, requirements, scope, evidence, complete-task, template approve/activate)
- UI tabs under `app/insightbooks/customer-success/onboarding/projects/[id]/{kick-off,tasks,stakeholders,requirements}`

## Constraints honored

- [x] Extend Wave 1 domain; no second onboarding domain
- [x] Materialise Workstreams/Milestones/Tasks/Checklists once (idempotent)
- [x] Kick-off creates/links CrmMeeting once; RSVP ? attendance
- [x] Meeting unavailable ? typed `MEETING_SERVICE_UNAVAILABLE`
- [x] Customer Task complete blocked without evidence source or authorised waiver
- [x] Evidence = admin attestation; portal `CUSTOMER_PORTAL_NOT_CONFIGURED`
- [x] Scope mismatch ? Change Request; does **not** mutate Subscription entitlements
- [x] Circular dependencies rejected
- [x] No Tenant GL; no fabricate kick-off complete without Meeting; no Training complete
- [x] No git commit

## Self-review

| Check | Notes |
|-------|--------|
| Domain isolation | All under `customerSuccess/onboarding/*`; meetings via Phase 13 import / injectable mock |
| Idempotency | Materialisation + kick-off keyed + project unique |
| RSVP boundary | Kick-off keeps `kickoffCompleted: false` after RSVP; attendance stays UNKNOWN |
| Entitlements | `detectScopeMismatch` never calls `subscription.update` |
| Model guards | Wave 2 `hasCustomerOnboarding*Model` for EPERM / SQL-only path |

## Concerns / follow-ups

1. **Prisma generate** � schema extended; Windows EPERM may still block generate. Prefer SQL fallback until generate succeeds.
2. **Kick-off Meeting create default path** � production uses real `createMeeting` (needs timezone/CRM access); tests inject `meetingService`.
3. **SoD on template approve** � soft (approver ? author not hard-enforced in Wave 2).
4. **SDD review gate** before Wave 3 (readiness / go-live / completion).

## Commits

**None** (per brief).

## Fix wave

Review findings addressed (no scope expansion, no git commit):

1. `materialise.js` / `kickoff.js` � idempotency key hit with disagreeing `projectId` (and for materialise `templateVersionId`) ? `idempotency_conflict`; exact match ? existing.
2. `materialise.js` � project-level replay with different `templateVersionId` than Project pin / prior materialisation ? `template_version_mismatch`.
3. `scope.js` `detectScopeMismatch` � omitted/null `requestedScope` skips detection (no CR); does not coerce to `{}`.

### Tests added

- materialise idempotency key conflict when projectId/templateVersionId disagree
- project-level materialise replay rejects different templateVersionId than pin
- kick-off idempotency key conflict when projectId disagrees
- omitted requestedScope does not open a SCOPE_MISMATCH change request

### Command output

```text
$ npx vitest run test/systemAdmin.cs.onboardingWave1.test.js test/systemAdmin.cs.onboardingWave2.test.js

 RUN  v4.1.2 C:/laragon/www/insight-books-v2.5

 Test Files  2 passed (2)
      Tests  23 passed (23)
   Start at  03:30:38
   Duration  3.94s (transform 5.45s, setup 0ms, import 6.07s, tests 132ms, environment 0ms)
```
