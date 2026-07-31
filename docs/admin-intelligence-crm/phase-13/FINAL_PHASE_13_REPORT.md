# Phase 13 Final Report — Sales Activity Management

**Decision:** **READY_FOR_PHASE_14_WITH_BLOCKERS**

**Date:** 2026-07-30

**Working tree:** Phase 13 Waves 0–4 delivered in-place on branch `v2` (no git commit required for Wave 4 exit). Phases 7–12 remain in the same working tree.

Sales Activity ships one canonical **CrmActivity** spine (`ACT-YYYY-######`) under `/insightbooks/crm/activities` with Tasks, Follow-Ups, Calls (manual/planned), Email (SMTP), Meetings, internal Calendar + ICS, Reminders (dedupe; delivery ≠ complete), versioned Activity/Task templates, automation foundations (SoD; small approved triggers; idempotent), and honesty-gated Activity reporting + audited schedules. Telephony, Google/Outlook sync, full sales sequences, Demo/Proposal/Tenant provision, and Email/WhatsApp Lead ingest remain explicit blockers.

## Delivered

| Wave | Focus | Status |
|------|-------|--------|
| 0 | Forensic audits + matrices + CONDITIONAL GO | Done |
| 1 | Canonical Activity + Task/Note migrate; Follow-Up + Next-Action | Done |
| 2 | Call (manual/planned + telephony NOT_AVAILABLE); Email SMTP + email templates | Done |
| 3 | Meeting + internal Calendar + conflicts + ICS; Google/Outlook NOT_CONNECTED | Done |
| 4 | Reminders; templates; automation foundations; reports/schedules; Phase 14 pack | Done |

## Surfaces (Wave 4)

### Libraries

- `lib/admin/crm/reminders.js` — schedule / queue / snooze / deliver; dedupe identity; delivery ≠ Activity complete
- `lib/admin/crm/templates.js` — versioned Activity/Task templates; ACTIVE not directly editable
- `lib/admin/crm/automation/*` — rule model, SoD approve (requester ≠ approver), idempotent execution; approved triggers only:
  - `LEAD_ASSIGNED` → `CREATE_FIRST_CONTACT_TASK`
  - `OPPORTUNITY_STAGE_ENTRY` → `CREATE_CHECKLIST_TASK`
  - `NO_NEXT_ACTION_WARNING` → `EMIT_NO_NEXT_ACTION_WARNING`
- `lib/admin/crm/activities/reports.js` + `reportSchedules.js` — Activity reporting centre + audited schedules
- `lib/admin/crm/activities/dataQuality.js` + `reconciliation.js` — DQ / recon foundations (honesty-gated)
- `lib/admin/crm/activities/entityPanel.js` — Lead/Opportunity Activity projections
- `lib/admin/crm/foundations.js` — `ACTIVITY_SPINE` → READY; REPORTING includes Activity plane; Email/WhatsApp stay NOT_AVAILABLE

### Prisma / SQL

- `CrmReminder`, `CrmActivityTemplate`, `CrmAutomationRule`, `CrmAutomationApproval`, `CrmAutomationExecution`
- `CrmActivityReportSchedule`, `CrmActivityReportRun`
- Fallback: `scripts/sql/crm-activity-phase13-wave4.sql`

### APIs

- `/api/admin/crm/reminders` — schedule / queue / deliver / snooze / list
- `/api/admin/crm/templates` — create version / update (non-ACTIVE) / list / active
- `/api/admin/crm/automation/rules` — create / request-approval / approve / execute / list
- `/api/admin/crm/activity-reports` — report / data-quality / reconciliation
- `/api/admin/crm/activity-report-schedules` — create / list / run

### UI

- Thin stubs: `/insightbooks/crm/reminders`, `/templates`, `/rules`, `/activity-reports`
- Lead + Opportunity detail panels list Activity projections (thin)
- Weighted Pipeline UI remains dark (Phase 16 — untouched)

## Hard rules preserved

- Activity ≠ Audit Event ≠ Analytics Event; Task ≠ CsTask; Call ≠ live telephony
- Reminder delivery ≠ Activity complete; Reminder ≠ Sales contact ≠ billing subscription reminder
- Planned ≠ completed; RSVP ≠ attendance; SMTP accept ≠ delivered
- Automation: SoD (no self-approval); idempotent; no full sequences; no arbitrary code
- Metric/report gate fail → never fabricated zeroes (EMPTY/UNAVAILABLE)
- Telephony NOT_AVAILABLE; Google/Outlook NOT_CONNECTED; tracking pixels off
- Closed Won / Activity never provisions Tenant / Subscription / Invoice
- SupportSlaCalendar / analytics-pipeline / POS sales never alias Sales Activity

## Verification

```bash
npx vitest run \
  test/systemAdmin.crm.activityWave4.test.js \
  test/systemAdmin.crm.activityWave3.test.js \
  test/systemAdmin.crm.activityWave2.test.js \
  test/systemAdmin.crm.activityWave1.test.js
```

**Result (2026-07-30):** Test Files 4 passed (4) · Tests 43 passed (43) — Waves 1–4 activity suites (post-review fixes included).

## Known blockers for Phase 14

1. **Telephony / Call recording** — `NOT_AVAILABLE` (typed contracts only)
2. **Google / Outlook calendar sync** — `NOT_CONNECTED` (ICS export only)
3. **Email / WhatsApp → Lead ingest** — still `NOT_AVAILABLE`
4. **Owner / team / territory list scope filtering** — `resolveCrmScope` still `mode: 'all'` stub
5. **Prisma generate / db push on Windows** — schema + SQL ready; apply when EPERM clears
6. **Demo management** — deferred to Phase 14 (explicitly out of Phase 13)
7. **Proposal create / Tenant provision from readiness** — handoff payloads only; no create/execute
8. **Full sales sequences / AI communications** — forbidden; foundations only
9. **Weighted Pipeline UI / reports** — deferred to Phase 16 (`WEIGHTED_PIPELINE_UI_ENABLED = false`)
10. **Rich UI hubs** — many Activity surfaces remain thin stubs; APIs are live

## Exit readiness

**READY_FOR_PHASE_14_WITH_BLOCKERS** — Phase 13 Waves 1–4 deliver an honest Activity plane including Reminders, templates, automation foundations, and Activity reporting; external providers, Demo, ingest, scope filtering, and provisioning remain explicit carry blockers.
