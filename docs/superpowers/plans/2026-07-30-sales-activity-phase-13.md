# Sales Activity & Engagement Phase 13 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Checkbox steps for tracking.

**Goal:** Ship one canonical CRM Activity spine under `/insightbooks/crm/activities` with Tasks, Follow-Ups, Calls, Emails (SMTP), Meetings, internal Calendar, Reminders, automation foundations, and Activity reporting — consent-aware, timezone-explicit, idempotent, and honesty-gated — without fabricating engagement or provisioning billing objects.

**Architecture:** Wave 0 forensic pack → `CrmActivity` parent + typed children in `lib/admin/crm/*` → migrate existing `CrmTask`/`CrmNote` under Activity → channel modules → Calendar → reminders/automation/reports. Telephony + Google/Outlook remain typed NOT_AVAILABLE / NOT_CONNECTED.

**Tech Stack:** Next.js, Prisma, Vitest, AdminShell, existing `lib/email` / `emailService`, consent/eligibility, en/ny, owner/team/territory scope.

**Spec:** [docs/superpowers/specs/2026-07-30-sales-activity-phase-13-design.md](../specs/2026-07-30-sales-activity-phase-13-design.md)

## Global Constraints

- Activity ≠ Audit Event ≠ Analytics Event.
- Task ≠ Call ≠ Meeting ≠ Demo; Note ≠ outbound communication.
- One Activity; many timeline projections — no duplicate records per entity view.
- Planned ≠ completed; RSVP ≠ attendance; SMTP accept ≠ delivered; reminder ≠ Sales contact.
- Outbound requires server eligibility + persisted decision; UNKNOWN consent ≠ granted.
- No fabricated Activities/Calls/Emails/deliveries/replies/Meetings/attendance/external sync.
- No AI communications; no Call recording (NOT_AVAILABLE); no undisclosed tracking pixels.
- No Demo/Proposal/Quotation/Tenant/Subscription/Invoice creation; CoA admin stays removed.
- No false zeroes on metric/report gate failure.
- Commits only when user asks; WORKING_TREE OK; SQL + `hasCrm*Model` guards if Prisma EPERM.

---

### Task 0: Wave 0 — Forensic audits + matrices

**Files:** `docs/admin-intelligence-crm/phase-13/*`

**Consumes:** Phase 12 `PHASE_13_INPUTS.md`, `PHASE_13_READINESS_CHECKLIST.md`, `FINAL_PHASE_12_REPORT.md`; existing `lib/admin/crm/{tasks,notes,timeline,consent,eligibility,foundations}.js`; P12 opportunity tasks/timeline.

- [x] Validate Phase 12 exit `READY_FOR_PHASE_13_WITH_BLOCKERS` (no identity/consent blockers)
- [x] CURRENT_* audits (architecture, task, follow-up, call, email activity, email infra, meeting, calendar, availability, timezone, reminder, note, template, automation, report, export)
- [x] DQ / recon / privacy / security / performance audits
- [x] Matrices: source, domain, task/call/email/meeting state, calendar integration, reminder, consent eligibility, reliability, security
- [x] `PHASE_13_GAP_REGISTER.md` + `IMPLEMENTATION_PLAN.md` + `FINAL_READINESS_DECISION.md`
- [x] CONDITIONAL GO for Wave 1 — **stop before Wave 1 code** unless user continues

---

### Task 1: Wave 1 — Activity spine + Task migrate + Follow-Up + Next-Action

**Files (create / extend):**
- `lib/admin/crm/activities/` — catalogue, numbering (`ACT-YYYY-######`), create/get/list, status history, relations, participants, ownership
- Extend `lib/admin/crm/tasks.js` + Prisma `CrmTask` — Activity FK; checklist/deps/recurrence foundations as scoped in Wave 1
- `lib/admin/crm/followUps.js` + next-action validation / no-next-action detection (Opportunity + Lead)
- Extend notes/timeline for Activity links; preserve restricted-note security
- Prisma + `scripts/sql/crm-activity-phase13-wave1.sql`
- APIs: `app/api/admin/crm/activities/**`, extend tasks/follow-ups
- UI: `/insightbooks/crm/activities` overview/my-work/list/detail stubs + task/follow-up hubs
- Tests: `test/systemAdmin.crm.activityWave1.test.js` (+ task/timeline regression)

**Interfaces (produce):**
- `createCrmActivity`, `getCrmActivity`, `listCrmActivities`, `transitionActivityStatus`
- `allocateActivityNumber` → `ACT-YYYY-######`
- Task create/complete/reopen wired to Activity; idempotent complete
- `evaluateNextAction`, `listNoNextActionOpportunities`, Follow-Up CRUD + complete/reschedule

- [ ] Canonical Activity types/statuses/directions; type↔status compatibility fail-closed
- [ ] Unique immutable Activity numbers; concurrency-safe
- [ ] Existing Lead/Opportunity tasks migrate/link under Activity (no competing task domains)
- [ ] Follow-Up + Next-Action / no-next-action; consent-blocked Follow-Ups not auto-executed
- [ ] Notes remain internal; restricted projection enforced
- [ ] Vitest PASS

---

### Task 2: Wave 2 — Calls + Email (SMTP) + email templates foundations

**Files:**
- `lib/admin/crm/calls/` — planned/inbound/outbound/manual log; outcomes; DNC; telephony boundary NOT_AVAILABLE; recording NOT_AVAILABLE
- `lib/admin/crm/emails/` — draft, eligibility, send-request, idempotency, SMTP via `lib/email`/`emailService`, delivery events (accept/sent/failed; DELIVERED only with evidence), no fabricated replies/opens
- Email template governance foundations (versioned; no executable expressions)
- Prisma + `scripts/sql/crm-activity-phase13-wave2.sql`
- APIs + UI: `/calls`, `/emails` (+ compose/sent/failed/drafts)
- Tests: `test/systemAdmin.crm.activityWave2.test.js`

**Interfaces (produce):**
- `planCall`, `logManualCall`, `completeCall` (no future-as-completed)
- `createEmailDraft`, `evaluateEmailEligibility`, `requestEmailSend` (idempotent), SMTP adapter mapping to ACCEPTED_BY_PROVIDER/SENT/FAILED
- Foundations: telephony provider contract status NOT_AVAILABLE

- [ ] Call numbers; consent/DNC enforced; no fabricated connect/recording
- [ ] Email send server-side only; retries return existing send request
- [ ] Accept ≠ delivered; no fabricated replies; no tracking pixels
- [ ] Vitest PASS (+ Wave 1 green)

---

### Task 3: Wave 3 — Meetings + internal Calendar + conflicts + ICS

**Files:**
- `lib/admin/crm/meetings/` — create, participants, timezone (UTC + display + original), invite foundation, RSVP ≠ attendance, reschedule history, cancel, outcomes, Follow-Up
- `lib/admin/crm/calendar/` — events, day/week/month/agenda queries (bounded), working hours, availability (privacy-safe), conflict policy, ICS export, Google/Outlook contracts NOT_CONNECTED
- Prisma + `scripts/sql/crm-activity-phase13-wave3.sql`
- APIs + UI: `/meetings`, `/calendar/**`
- Tests: `test/systemAdmin.crm.activityWave3.test.js`

**Interfaces (produce):**
- `createMeeting`, `rescheduleMeeting`, `cancelMeeting`, `recordAttendance` (authorised; never from RSVP alone)
- `listCalendarEvents`, `detectCalendarConflicts`, `exportIcs`, `getCalendarIntegrationStatus` → NOT_CONNECTED for Google/Outlook

- [ ] Explicit timezones; end-before-start blocked
- [ ] Conflict detect BLOCK/WARN/ALLOW_WITH_REASON
- [ ] External sync not fabricated; ICS export works
- [ ] Vitest PASS

---

### Task 4: Wave 4 — Reminders + templates + automation foundations + reports + Phase 14 pack

**Files:**
- Reminders (dedupe keys; snooze; delivery ≠ Activity complete)
- Activity/task templates (versioned; active not directly editable)
- Automation foundations (small approved trigger set; SoD; idempotent execution; no sequences)
- Activity metrics + reliability gate; DQ rules; reconciliation; reporting centre + schedules
- Entity integrations (Lead/Account/Contact/Opportunity activities panels; safe CS/Support/Product/Executive projections)
- Foundations upgrade for Activity plane honesty
- Docs: `FINAL_PHASE_13_REPORT.md`, `PHASE_14_INPUTS.md`, `PHASE_14_READINESS_CHECKLIST.md`, `FINAL_READINESS_DECISION.md`
- Prisma + `scripts/sql/crm-activity-phase13-wave4.sql`
- Tests: `test/systemAdmin.crm.activityWave4.test.js`

- [x] Reminder dedupe; automation SoD + idempotency; no arbitrary code
- [x] Reports honesty-gated; scheduled reports audited; no false zeroes
- [x] Exit `READY_FOR_PHASE_14_WITH_BLOCKERS`
- [x] Related vitest PASS

---

## File map (locked decomposition)

| Area | Primary paths |
|------|----------------|
| Activity spine | `lib/admin/crm/activities/*` |
| Tasks | `lib/admin/crm/tasks.js` (+ activity link); checklists/deps/recurrence modules as needed |
| Follow-ups | `lib/admin/crm/followUps.js` |
| Calls | `lib/admin/crm/calls/*` |
| Emails | `lib/admin/crm/emails/*` |
| Meetings | `lib/admin/crm/meetings/*` |
| Calendar | `lib/admin/crm/calendar/*` |
| Reminders / automation | `lib/admin/crm/reminders.js`, `lib/admin/crm/automation/*` |
| Reports | `lib/admin/crm/activities/reports.js` (+ schedules) |
| SQL | `scripts/sql/crm-activity-phase13-wave{1,2,3,4}.sql` |
| UI | `app/insightbooks/crm/{activities,tasks,follow-ups,calls,emails,meetings,calendar,notes,reminders}/**` |
| APIs | `app/api/admin/crm/{activities,tasks,follow-ups,calls,emails,meetings,calendar,reminders}/**` |
| Wave 0 / exit docs | `docs/admin-intelligence-crm/phase-13/*` |

---

## Plan self-review

- Spec locked decisions map to Tasks 0–4 (Approach B waves).
- Email SMTP + calendar NOT_CONNECTED + call telephony boundary + automation foundations + reporting centre covered.
- No TBD blocking Wave 0.
- Commit steps omitted per global constraint (user asks for commits).
- Detailed master-prompt matrices/docs land in Wave 0; full catalogue docs fill as waves ship (no empty placeholders).
