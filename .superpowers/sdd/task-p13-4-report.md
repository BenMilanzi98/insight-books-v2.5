# Task P13-4 Report — Wave 4 Reminders + templates + automation + reports + Phase 14 pack

**Status:** DONE  
**Date:** 2026-07-30  
**Branch:** v2 WORKING_TREE  
**Commit:** none (per brief)  
**Exit decision:** **READY_FOR_PHASE_14_WITH_BLOCKERS**

## Acceptance

| Item | Result |
|------|--------|
| Reminder dedupe; delivery ≠ completion | PASS |
| Automation SoD + idempotency; small trigger set only | PASS |
| Reports honesty-gated; schedules audited | PASS |
| FINAL_PHASE_13_REPORT + PHASE_14_INPUTS + CHECKLIST | PASS |
| Exit READY_FOR_PHASE_14_WITH_BLOCKERS | PASS |
| Vitest PASS (Wave 4 + prior activity suites) | PASS (4 files / 43 tests) |

## Interfaces delivered

**Reminders**
- `buildReminderDedupeKey`, `scheduleReminder`, `queueDueReminders`, `markReminderDelivered`, `snoozeReminder`, `listReminders`
- Dedupe: `ruleKey|activityId|recipientAdminId|occurrenceKey|channel`
- `activityCompletedByDelivery: false` always

**Templates**
- `createActivityTemplateVersion`, `updateActivityTemplate` (ACTIVE blocked), `getActiveActivityTemplate`, `listActivityTemplates`

**Automation**
- `createAutomationRule`, `requestAutomationApproval`, `approveAutomationRule` (SoD), `executeAutomationRule` (idempotent)
- Approved: Lead assigned → first-contact Task; Opportunity stage entry → checklist Task; no-next-action warning

**Reports / DQ / recon**
- `getActivityReport`, `applyActivityReportHonesty`, schedules create/list/run
- `evaluateActivityDataQuality`, `runActivityReconciliation`
- `listEntityActivityProjections`

**Foundations**
- `ACTIVITY_SPINE` → READY; REPORTING includes Activity plane; telephony / Google-Outlook / ingest honesty preserved

## Files (primary)

**Lib**
- `lib/admin/crm/reminders.js`
- `lib/admin/crm/templates.js`
- `lib/admin/crm/automation/{catalogue,rules,execute,index}.js`
- `lib/admin/crm/activities/{reports,reportSchedules,dataQuality,reconciliation,entityPanel}.js`
- Extended: `catalogue.js`, `foundations.js`, `index.js`, `activities/index.js`, `crmNav.js`

**Prisma / SQL**
- `prisma/schema.prisma` — Reminder, ActivityTemplate, Automation*, ActivityReportSchedule/Run + Admin relations
- `scripts/sql/crm-activity-phase13-wave4.sql`

**APIs**
- `app/api/admin/crm/reminders/route.js`
- `app/api/admin/crm/templates/route.js`
- `app/api/admin/crm/automation/rules/route.js`
- `app/api/admin/crm/activity-reports/route.js`
- `app/api/admin/crm/activity-report-schedules/route.js`

**UI**
- Stubs: `/insightbooks/crm/reminders`, `/templates`, `/rules`, `/activity-reports`
- Lead + Opportunity detail Activity projection panels
- en/ny locale + nav keys

**Docs**
- `docs/admin-intelligence-crm/phase-13/FINAL_PHASE_13_REPORT.md`
- `PHASE_14_INPUTS.md`
- `PHASE_14_READINESS_CHECKLIST.md`
- `FINAL_READINESS_DECISION.md` (exit)

**Tests**
- `test/systemAdmin.crm.activityWave4.test.js` (new)

## Tests run

```text
npx vitest run test/systemAdmin.crm.activityWave4.test.js \
  test/systemAdmin.crm.activityWave3.test.js \
  test/systemAdmin.crm.activityWave2.test.js \
  test/systemAdmin.crm.activityWave1.test.js
→ 4 files, 43 tests PASS
```

## Self-review

- Reminder dedupe identity enforced; deliver/snooze/queue never complete Activity.
- ACTIVE templates rejected on in-place update; new version required.
- Automation rejects non-approved actions; self-approval blocked; execute idempotent on key.
- Empty / gate-failed reports return null KPIs (EMPTY/UNAVAILABLE) — no false zeroes.
- Weighted Pipeline flag untouched (`false`).
- Demo / telephony / Google-Outlook / ingest / sequences / provision explicitly not shipped.

## Honest carry blockers (Phase 14)

1. Telephony + Call recording — NOT_AVAILABLE  
2. Google / Outlook sync — NOT_CONNECTED  
3. Email / WhatsApp Lead ingest — NOT_AVAILABLE  
4. `resolveCrmScope` still `mode: 'all'` stub  
5. Prisma generate/push Windows EPERM — SQL fallback shipped  
6. Demo management — deferred to Phase 14  
7. Proposal create / Tenant provision — handoffs only  
8. Full sales sequences / AI comms — out of scope  
9. Weighted Pipeline UI — Phase 16  
10. Rich UI hubs — many still stubs  

## Not done (explicit)

- Git commit  
- Live telephony / Google-Outlook / Demo / sequences  
- Fabricating Activity completion from Reminder delivery  

## Progress ledger

Task 4 marked complete in `.superpowers/sdd/progress-phase13.md`.

## Post-review fixes

**Finding 1:** FAILED automation executions poisoned the idempotency key — retries returned `ok: true` / `IDEMPOTENT_REPLAY` without re-running.

**Fix:** `executeAutomationRule` only short-circuits successful idempotent replay for prior `SUCCESS`/`SKIPPED`. Prior `FAILED` (non-success) rows are retried and updated in place; unique-race against a failed prior returns `ok: false` with the prior failure visible.

**Finding 2:** `updateActivityTemplate` could set DRAFT→ACTIVE without retiring other ACTIVE versions for the same template code.

**Fix:** Activating via update now retires other ACTIVE rows for that code (same as `createActivityTemplateVersion` when status is ACTIVE).

**Tests:** Wave 4 adds FAILED-retry idempotency regression and DRAFT→ACTIVE retire-prior-ACTIVE via update.

```text
npx vitest run test/systemAdmin.crm.activityWave4.test.js \
  test/systemAdmin.crm.activityWave3.test.js \
  test/systemAdmin.crm.activityWave2.test.js \
  test/systemAdmin.crm.activityWave1.test.js
→ 4 files, 43 tests PASS
```
