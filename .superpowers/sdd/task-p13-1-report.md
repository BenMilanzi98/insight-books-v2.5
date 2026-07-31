# Task P13-1 Report — Wave 1 Activity spine + Task migrate + Follow-Up + Next-Action

**Status:** DONE_WITH_CONCERNS  
**Date:** 2026-07-30  
**Branch:** v2 WORKING_TREE  
**Commit:** none (per brief)

## Acceptance

| Item | Result |
|------|--------|
| Canonical Activity types/statuses/directions; incompatible status rejected | PASS |
| Unique immutable ACT numbers | PASS (`ACT-YYYY-######` via CrmNumberSeq CAS) |
| Lead/Opportunity tasks link under Activity (single domain) | PASS |
| Follow-Up + Next-Action / no-next-action; consent-blocked not auto-executed | PASS |
| Restricted notes still protected | PASS |
| Vitest PASS (Wave 1 + prior task/timeline regression) | PASS |

## Interfaces delivered

- `allocateActivityNumber`, `createCrmActivity`, `getCrmActivity`, `listCrmActivities`, `transitionActivityStatus`
- Task create/complete/reopen wired to Activity; idempotent complete; optional `TASK-YYYY-######`
- `createFollowUp`, `completeFollowUp`, `rescheduleFollowUp`, `listFollowUps`
- `evaluateNextAction`, `listNoNextActionOpportunities`, `listNoNextActionLeads`

## Files (primary)

**Lib**
- `lib/admin/crm/activities/*` — catalogue, numbering, model, create, get, list, status, relations, participants, index
- `lib/admin/crm/followUps.js`, `lib/admin/crm/nextAction.js`
- Extended: `tasks.js`, `notes.js`, `timeline.js`, `catalogue.js`, `authz.js`, `foundations.js`, `index.js`
- `lib/admin/crmNav.js`, `lib/admin/permissions.js`

**Prisma / SQL**
- `prisma/schema.prisma` — `CrmActivity`, status history, relations, participants, `CrmFollowUp` (+ history); `CrmTask.activityId`/`taskNumber`; `CrmNote.activityId`
- `scripts/sql/crm-activity-phase13-wave1.sql`

**APIs**
- `app/api/admin/crm/activities/` (list/create, get, status)
- `app/api/admin/crm/follow-ups/` (+ complete, reschedule)
- `app/api/admin/crm/tasks/[id]/reopen`
- `app/api/admin/crm/next-action`

**UI (thin stubs)**
- `/insightbooks/crm/activities` (+ my-work, list, `[id]`)
- `/insightbooks/crm/tasks`, `/insightbooks/crm/follow-ups`
- en/ny locale keys (`admin-pages`, `admin-shell`)

**Tests**
- `test/systemAdmin.crm.activityWave1.test.js` (new)

## Tests run

```text
npx vitest run test/systemAdmin.crm.activityWave1.test.js test/systemAdmin.crm.wave4.test.js
→ 2 files, 18 tests PASS

npx vitest run test/systemAdmin.crm.opportunityWave3.test.js test/systemAdmin.crm.opportunityWave4.test.js test/systemAdmin.crm.consent.test.js
→ 3 files, 27 tests PASS
```

## Self-review

- No CsTask / Support / analytics aliasing; Activity ≠ Audit/Analytics enforced in docs + foundations contract.
- Type↔status fail-closed; Planned ≠ completed by due date alone.
- One Activity + relation/timeline projections; Task create links Activity when model available; graceful skip when unavailable (Prisma EPERM path).
- Consent-blocked Follow-Up → `BLOCKED_BY_CONSENT`, `autoExecuted: false`.
- Next-action envelopes: VALID / MISSING / OVERDUE / BLOCKED_BY_CONSENT / UNAVAILABLE; `fabricated: false`.
- Restricted notes omit for unprivileged viewers (incl. Activity-linked).

## Concerns (non-blocking)

1. **Prisma client generate not run** — schema + SQL shipped; Windows EPERM may require SQL apply + `hasCrm*Model` guards (already used). Until generate/db push, runtime Activity models may be UNAVAILABLE.
2. **UI hubs are stubs** — overview/my-work/list/detail + tasks/follow-ups use `CrmStubView`; APIs are live.
3. **Existing rows** — pre-Wave-1 `CrmTask`/`CrmNote` remain with null `activityId` until touched by new creates (no backfill job in this task).
4. **Task checklist/deps/recurrence** — deferred (gap G13-25); Wave 1 foundations only.
5. **Calls / Email / Meetings / Calendar** — correctly out of scope for Wave 1.

## Not done (explicit)

- Git commit
- Wave 2+ channel modules
- Reminder / automation / reporting centre

## Post-review fixes

**Finding:** `createTask` soft-continued and created a Task with `activityId: null` when the Activity model was present but `createCrmActivity` failed (Follow-Up already fail-closed).

**Fix:** In `lib/admin/crm/tasks.js`, when `hasCrmActivityModel(prisma)` is true, Task create now returns the Activity error and does not create an orphan Task (matches Follow-Up). When the Activity model is unavailable (EPERM/guard), Task create may still proceed without an Activity link.

**Test:** Wave 1 covers fail-closed Task create when Activity create fails (`crmNumberSeq` removed so Activity model stays present but numbering fails) — asserts `ok: false` and `crmTask.create` not called.

```text
npx vitest run test/systemAdmin.crm.activityWave1.test.js
→ 1 file, 8 tests PASS
```
