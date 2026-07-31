# Task P14-1 Report — Wave 1 Demo Request + Demo + schedule + participants + readiness spine

**Status:** DONE  
**Date:** 2026-07-30  
**Branch:** v2 WORKING_TREE  
**Commit:** none (per brief)

## Acceptance

| Item | Result |
|------|--------|
| DMR/DEMO numbers unique immutable | PASS (`DMR-YYYY-######` / `DEMO-YYYY-######` via CrmNumberSeq CAS) |
| Qualify/convert; convert idempotent | PASS (stable `dmr-convert:{requestId}`; exact retry → existing Demo) |
| Schedule creates/links Meeting+Calendar; end-before-start / timezone via P13 | PASS (post-review: alreadyExists requires live Meeting+Calendar) |
| Readiness blocks when required items missing | PASS (Meeting/presenter/Contact blockers; READY_TO_DELIVER gated) |
| Vitest PASS | PASS |

## Interfaces delivered

- `allocateDemoRequestNumber`, `allocateDemoNumber`
- `createDemoRequest`, `qualifyDemoRequest`, `rejectDemoRequest`, `convertDemoRequest`, `listDemoRequests`
- `createDemo`, `getDemo`, `listDemos`, `transitionDemoStatus`
- `scheduleDemo` → CrmMeeting + Calendar Event (times reconcile)
- `evaluateDemoReadiness` (NOT_READY / PARTIALLY_READY / READY / BLOCKED)
- `addDemoParticipant`, `removeDemoParticipant`, `listDemoParticipants`
- `listDemosForLead`, `listDemosForOpportunity` (thin projections; no Opportunity mutation)
- `getDemoDomainContract`

## Files (primary)

**Lib**
- `lib/admin/crm/demos/*` — catalogue, numbering, model, requests, service, schedule, participants, readiness, projections, index
- Extended: `catalogue.js` (DMR/DEMO prefixes, statuses, transitions, timeline, DEMO subject, DEMO_SPINE), `index.js`, `foundations.js`, `crmNav.js`, `permissions.js`

**Prisma / SQL**
- `prisma/schema.prisma` — `CrmDemoRequest`, `CrmDemo`, `CrmDemoParticipant`, `CrmDemoStatusHistory` + Admin relations
- `scripts/sql/crm-demo-phase14-wave1.sql`

**APIs**
- `app/api/admin/crm/demo-requests/` (list/create, `[id]/[action]` qualify|reject|convert)
- `app/api/admin/crm/demos/` (list/create, `[id]`, `[id]/[action]` schedule|status|readiness|participants|remove-participant)

**UI (thin stubs)**
- `/insightbooks/crm/demos` (+ my-demos, list, `[id]`, requests)
- en/ny locale keys (`admin-pages`, `admin-shell`)

**Tests**
- `test/systemAdmin.crm.demoWave1.test.js` (new)

## Tests run

```text
npx vitest run test/systemAdmin.crm.demoWave1.test.js test/systemAdmin.crm.activityWave3.test.js test/systemAdmin.crm.activityWave1.test.js
→ 3 files, 23 tests PASS (pre-review)

npx vitest run test/systemAdmin.crm.demoWave1.test.js
→ 1 file, 9 tests PASS (post-review fix)
```

## Self-review

- Demo ≠ Meeting; schedule requires Meeting + Calendar; times/timezone reconcile via Phase 13.
- Convert Demo Request ≠ create Opportunity / Proposal / Tenant; convert idempotent.
- RSVP ≠ attendance; participant attendance stays UNKNOWN; no fabricated attendance.
- Readiness honesty: BLOCKED lists reasons; missing Meeting/presenter/Contact blocks READY_TO_DELIVER.
- Wave 2–3 agenda/script/env listed as INFO (non-blocking) on readiness spine.
- Never aliases MRA EIS sandbox as Demo Environment (`getDemoDomainContract`).
- SQL + `hasCrm*Model` guards for Prisma EPERM path.

## Concerns (non-blocking)

1. **Prisma client generate not run** — schema + SQL shipped; Windows EPERM may require SQL apply + guards (already used). Until generate/db push, runtime Demo models may be UNAVAILABLE.
2. **UI hubs are stubs** — overview/my-demos/list/detail/requests use `CrmStubView`; APIs are live.
3. **Agenda / Script / Env / Delivery** — correctly out of scope for Wave 1 (Waves 2–4).
4. **Scope stub** — portfolio lists reuse activities/leads view authz; true territory filter still deferred.

## Not done (explicit)

- Git commit
- Wave 2+ Agenda/Script/Content
- Environments / checklists / rehearsals
- Delivery / recording / feedback / outcome / Proposal create

## Post-review fixes

**Important — `scheduleDemo` alreadyExists skipped Calendar guard**

- **Issue:** Fail-closed calendar check used `if (!calendarEventId && !meetingResult.alreadyExists)`. After Phase 13 calendar-create failure (Meeting cancelled, idempotency key kept), retry returned `createMeeting` `alreadyExists: true` without Calendar and could persist Demo as `SCHEDULED`.
- **Fix (`lib/admin/crm/demos/schedule.js`):** Always resolve a live (non-`CANCELLED`) Meeting **and** a live Calendar Event before marking Demo `SCHEDULED`. On `alreadyExists` / idempotent paths, verify Meeting status; look up Calendar by `meetingId` (recreate via `createCalendarEventForMeeting` when Meeting is live but Calendar missing); fail closed with `meeting_cancelled_cannot_schedule_demo` / `calendar_event_required_for_demo_schedule` otherwise.
- **Regression:** `schedule retry after calendar-create failure does not mark Demo SCHEDULED without Calendar` in `test/systemAdmin.crm.demoWave1.test.js`.
- **Verify:** `npx vitest run test/systemAdmin.crm.demoWave1.test.js` → **1 file, 9 tests PASS**.
