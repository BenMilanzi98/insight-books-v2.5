# Phase 13 Final Review — Sales Activity Management

**Head:** `WORKING_TREE` (dirty with Phases 7–13; no SHA range)  
**Scope:** Phase 13 CRM Activity surfaces (spine → channels → calendar → reminders/automation/reports)  
**Spec / plan:** `docs/superpowers/specs/2026-07-30-sales-activity-phase-13-design.md` · `docs/superpowers/plans/2026-07-30-sales-activity-phase-13.md`  
**Claimed exit:** `READY_FOR_PHASE_14_WITH_BLOCKERS` (`docs/admin-intelligence-crm/phase-13/FINAL_PHASE_13_REPORT.md`)  
**Prior task reviews:** P13-T0…T4 all **Approved** (T1 after fail-closed Task fix; T2 after outbound Contact gate; T4 after FAILED-retry + template ACTIVE retire)  
**Mode:** Read-only (this file is the only write)  
**Date:** 2026-07-30  

---

## Verification re-run

```bash
npx vitest run \
  test/systemAdmin.crm.activityWave1.test.js \
  test/systemAdmin.crm.activityWave2.test.js \
  test/systemAdmin.crm.activityWave3.test.js \
  test/systemAdmin.crm.activityWave4.test.js
```

**Result (this review):** Test Files **4** passed (4) · Tests **43** passed (43) · failed **0**

> Note: `FINAL_PHASE_13_REPORT.md` claims **41** tests. Working-tree suites total **43** after Wave 4 Important-fix regressions (FAILED automation retry + DRAFT→ACTIVE retire). Suites themselves are green.

---

## Hard rules matrix

| # | Rule | Status | Evidence |
|---|------|--------|----------|
| 1 | Activity ≠ Audit Event ≠ Analytics Event | ✅ Pass | Dedicated `CrmActivity` spine + typed children; foundations/index comments; no analytics-pipeline / audit alias |
| 2 | Task ≠ Call ≠ Meeting ≠ Demo; Note ≠ outbound | ✅ Pass | Separate Call/Email/Meeting modules; creatable types exclude Demo entity; `DEMO_REQUEST` remains capture/handoff catalogue only → Phase 14 |
| 3 | Planned ≠ completed; due-date pass ≠ complete | ✅ Pass | Type↔status compat; Wave 1 tests Planned + past due stays Planned; future Call cannot complete |
| 4 | RSVP ≠ attendance | ✅ Pass | `recordMeetingRsvp` vs authorised `recordAttendance`; `fromRsvpAlone: false` / `fabricatedAttendance: false` |
| 5 | SMTP accept ≠ delivered; no fabricated opens/replies | ✅ Pass | Adapter maps SENT/ACCEPTED_BY_PROVIDER/FAILED only; `delivered: false`; pixels flag off |
| 6 | Consent / DNC; UNKNOWN ≠ granted; outbound Contact required | ✅ Pass | Eligibility before outbound Call/Email/invite; `requireOutboundContact` → `CONTACT_REQUIRED`; consent-blocked Follow-Up not auto-executed |
| 7 | No fabricated engagement / external calendar Events | ✅ Pass | Next-action `fabricated: false`; Google/Outlook `NOT_CONNECTED`; ICS `externalSync: false` |
| 8 | Telephony / recording NOT_AVAILABLE | ✅ Pass | `CRM_TELEPHONY_PROVIDER_STATUS` / recording status; Call serialize never invents live connect |
| 9 | Reminder delivery ≠ Activity complete | ✅ Pass | `activityCompletedByDelivery: false` on schedule/deliver/serialize; no Activity complete side-effect |
| 10 | Automation foundations only; SoD; idempotent; no sequences | ✅ Pass | Allow-listed triggers/actions; self-approval blocked when requester present; SUCCESS/SKIPPED-only idempotent replay; FAILED retries |
| 11 | Reports honesty-gated; no false zeroes | ✅ Pass | `applyActivityReportHonesty` → EMPTY/UNAVAILABLE; `inventZeroesForbidden`; schedules audited |
| 12 | No Demo / Proposal / Tenant provision; CoA stays removed | ✅ Pass | No Demo/provision create paths in Activity libs; `/insightbooks/chart-of-accounts` still redirects removed |
| 13 | No CsTask / SupportSlaCalendar / POS sales alias | ✅ Pass | Explicit WRONG_DOMAIN in Wave 0 + calendar/tasks comments; Support SLA calendar not reused |

---

## Wave / surface coverage (WORKING_TREE)

| Wave | Delivered | Notes |
|------|-----------|--------|
| 0 | Forensic pack + CONDITIONAL GO under `docs/admin-intelligence-crm/phase-13/` | 41 markdown files present; T0 Approved |
| 1 | `CrmActivity` (`ACT-YYYY-######`) + Task migrate + Follow-Up + Next-Action | Fail-closed Task/Follow-Up on Activity create failure; APIs + thin hubs |
| 2 | Calls (manual/planned) + Email SMTP + email templates foundations | Contact + eligibility before outbound; telephony/recording NOT_AVAILABLE |
| 3 | Meetings + internal Calendar + conflicts + ICS | RSVP≠attendance; Google/Outlook NOT_CONNECTED |
| 4 | Reminders; templates; automation foundations; reports/schedules; Phase 14 pack | `FINAL_PHASE_13_REPORT` + `PHASE_14_INPUTS` + checklist; entity projections thin |

SQL fallbacks: `scripts/sql/crm-activity-phase13-wave{1..4}.sql` present (EPERM path documented).

UI: thin stubs for activities/tasks/follow-ups/calls/emails/meetings/calendar/reminders/templates/rules/activity-reports. Dedicated `/notes` hub page absent (notes security still enforced via existing notes libs — acceptable stub gap).

---

## Findings

### Critical / P0

_None._

### Important / P1

_None._

### Ordinary / P2

_None new at whole-phase level._ Prior Important defects (orphan Task on Activity failure; outbound without Contact; FAILED automation poisoning idempotency; ACTIVE template activate-via-update skipping retire) were fixed in-task and re-verified green.

### Low / P3

#### [P3] Final report understates Vitest counts — `docs/admin-intelligence-crm/phase-13/FINAL_PHASE_13_REPORT.md`

Claims **41** tests; re-run shows **43** (Wave 4 Important-fix regressions). Correct the report so exit evidence stays honest.

#### [P3] Activity + child create not one transaction — Calls/Emails/Meetings/Tasks/Follow-Ups

Activity is created, then the typed child. Child-create failure can leave an orphan Activity (+ burned ACT/MEET/CALL number). Prefer `$transaction` or compensate-delete. Carried from T1–T3; acceptable for foundations exit.

#### [P3] Calendar create failure after Meeting persist — `lib/admin/crm/meetings/service.js`

If calendar event create fails, Meeting is best-effort cancelled but CrmActivity may remain. Soft-skip when calendar model absent (mirror Activity EPERM) or compensate Activity.

#### [P3] SoD gap when `requestedByAdminId` empty — `lib/admin/crm/automation/rules.js`

`approveAutomationRule` only blocks self-approval when requester id is present. Edge case if rule created without admin id.

#### [P3] Direction not enum-validated on Activity create — `lib/admin/crm/activities/create.js`

Any uppercase `direction` string accepted; fail-closed against `CRM_ACTIVITY_DIRECTIONS` would match status hygiene.

#### [P3] Plan Task 1–3 checkboxes still unchecked — `docs/superpowers/plans/2026-07-30-sales-activity-phase-13.md`

Task 4 boxes are checked; Tasks 1–3 remain `[ ]` despite Approved reviews. Docs hygiene only.

#### [P3] Residual carry items (already in FINAL report blockers)

- Telephony / recording NOT_AVAILABLE; Google/Outlook NOT_CONNECTED; Email/WhatsApp ingest NOT_AVAILABLE
- `resolveCrmScope` still `mode: 'all'` stub
- Prisma generate / db push EPERM on Windows (SQL + `hasCrm*Model` guards)
- Demo / Proposal create / Tenant provision deferred; full sequences / AI forbidden
- Weighted Pipeline UI dark (Phase 16)
- Rich UI hubs remain thin stubs; APIs live
- Invitation delivery foundation-only (no live invite SMTP)
- Concurrent FAILED automation retries can double-run action (no distributed lock)
- Stuck Email send-request (`REQUESTED`) idempotent lookup does not re-attempt SMTP

---

## Spec / exit assessment

Phase 13 Waves 0–4 deliver the locked design: forensic CONDITIONAL GO → canonical Activity spine with Task/Follow-Up/Next-Action → Calls + SMTP Email honesty → Meetings + internal Calendar/ICS with NOT_CONNECTED externals → Reminders (delivery ≠ complete), versioned templates, SoD automation foundations, honesty-gated Activity reporting, and an explicit Phase 14 pack with carry blockers.

Claimed blockers match the tree (telephony, Google/Outlook, ingest, scope stub, EPERM, Demo, provision, sequences/AI, weighted UI, thin UI). Hard rules held under re-review; Important in-wave defects were closed before this final gate.

P3 items are hygiene / hardening / docs — they do **not** reopen fabrication, consent bypass, RSVP/attendance collapse, SMTP-as-delivered, telephony enablement, external calendar invent, Demo/provision, or false report zeroes. They do not invalidate `READY_FOR_PHASE_14_WITH_BLOCKERS`.

---

## Overall verdict

**Phase quality:** Approved

**Exit `READY_FOR_PHASE_14_WITH_BLOCKERS`:** Justified — hard rules held; Wave 0–4 surfaces present; Vitest Phase 13 suite green (**43/43**); known blockers are explicit and correctly deferred rather than papered over. Correct the final-report test count (P3) when editing docs; treat orphan-Activity compensation and SoD empty-requester edge as Phase 14 hygiene or a small Phase 13 follow-up before heavy production automation use.
