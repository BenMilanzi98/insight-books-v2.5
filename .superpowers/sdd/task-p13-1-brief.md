### Task 1: Wave 1 — Activity spine + Task migrate + Follow-Up + Next-Action

**Depends on:** Wave 0 CONDITIONAL GO; existing `CrmTask` / `CrmNote` / `CrmTimelineEvent` / consent / eligibility (WORKING_TREE Phases 11–12).

**Files (create / extend):**
- `lib/admin/crm/activities/` — `catalogue.js`, `numbering.js`, `create.js`, `get.js`, `list.js`, `status.js`, `relations.js`, `participants.js`, `model.js`, `index.js`
- Extend `lib/admin/crm/tasks.js` — Activity link on create; task number `TASK-YYYY-######` optional; complete/reopen idempotent; serialize `activityId`
- `lib/admin/crm/followUps.js` — Follow-Up model ops; create/complete/reschedule; consent-blocked not auto-executed
- `lib/admin/crm/nextAction.js` — `evaluateNextAction`, `listNoNextActionOpportunities` (and Lead variant if natural)
- Extend notes/timeline for Activity subject/relation; restricted notes stay API-enforced
- Extend `lib/admin/crm/{authz,catalogue,index,foundations}.js` + nav/permissions for activities/tasks/follow-ups
- Prisma: `CrmActivity`, `CrmActivityStatusHistory`, `CrmActivityRelation`, `CrmActivityParticipant` (minimal Wave 1), `CrmFollowUp` (+ history if needed); `CrmTask.activityId`, `CrmTask.taskNumber?`, `CrmNote.activityId?`
- SQL: `scripts/sql/crm-activity-phase13-wave1.sql`
- APIs: `app/api/admin/crm/activities/` (list/create/get/status), follow-ups routes, extend tasks
- UI: `/insightbooks/crm/activities` (overview/my-work/list/[id] stubs), `/tasks`, `/follow-ups` thin hubs (AdminShell, en/ny)
- Tests: `test/systemAdmin.crm.activityWave1.test.js` + keep existing task/timeline suites green

**Do NOT:** Calls, Email SMTP send, Meetings, Calendar, reminders engine, automation rules, reporting centre, Demo/Proposal, Tenant provision, git commit.

## Rules

- Activity parent + typed children: creating a Task creates/links a `CrmActivity` type `TASK`
- Numbers: `ACT-YYYY-######` unique immutable concurrency-safe; Task may use `TASK-YYYY-######`
- Type↔status compatibility fail-closed; Planned ≠ completed by due date alone
- One Activity; projections on Lead/Opportunity timelines — no duplicate Activity rows
- Follow-Up blocked by consent → status BLOCKED_BY_CONSENT; never auto-execute outbound
- Next-action: do not fabricate; MISSING/OVERDUE/VALID etc. honesty envelopes
- Notes INTERNAL/RESTRICTED unchanged security
- Never alias CsTask / Support tasks
- SQL + `hasCrm*Model` guards if Prisma EPERM

## Interfaces (must export)

- `allocateActivityNumber`, `createCrmActivity`, `getCrmActivity`, `listCrmActivities`, `transitionActivityStatus`
- Task create/complete wired to Activity; idempotent complete
- `createFollowUp`, `completeFollowUp`, `rescheduleFollowUp`
- `evaluateNextAction`, `listNoNextActionOpportunities`

## Acceptance

- [ ] Canonical Activity types/statuses/directions; incompatible status rejected
- [ ] Unique immutable ACT numbers
- [ ] Lead/Opportunity tasks link under Activity (single domain)
- [ ] Follow-Up + Next-Action / no-next-action; consent-blocked not auto-executed
- [ ] Restricted notes still protected
- [ ] Vitest PASS (Wave 1 + prior CRM task/timeline regression)

## Report

`.superpowers/sdd/task-p13-1-report.md` — DONE | DONE_WITH_CONCERNS | BLOCKED; files; tests; concerns. No commit.
