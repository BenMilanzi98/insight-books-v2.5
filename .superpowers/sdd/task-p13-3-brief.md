### Task 3: Wave 3 — Meetings + internal Calendar + conflicts + ICS

**Depends on:** Waves 1–2 CrmActivity + Call/Email (WORKING_TREE).

**Files:**
- `lib/admin/crm/meetings/` — create, numbering (`MEET-YYYY-######`), participants, timezone (UTC + display + original), invitations foundation, RSVP ≠ attendance, reschedule history, cancel, outcomes, Follow-Up hook
- `lib/admin/crm/calendar/` — events linked to Activities; day/week/month/agenda bounded queries; working hours; availability (hide private details); conflict detect BLOCK/WARN/ALLOW_WITH_REASON; ICS export; Google/Outlook integration status NOT_CONNECTED
- Link Meeting → CrmActivity type MEETING; fail-closed if Activity create fails
- Outbound invitations: Contact + eligibility (reuse Wave 2 Contact gate patterns)
- Prisma + `scripts/sql/crm-activity-phase13-wave3.sql`
- APIs + UI: `/meetings`, `/calendar` (day/week/month/agenda)
- Tests: `test/systemAdmin.crm.activityWave3.test.js` (+ Waves 1–2 green)

**Do NOT:** live Google/Outlook sync, fabricate attendance from RSVP, reminders/automation/reports, Demo management, git commit.

## Rules

- Explicit timezones; end-before-start blocked
- RSVP ACCEPTED ≠ ATTENDED; attendance requires authorised confirmation
- External sync NOT_CONNECTED — no fabricated external Events
- Conflict detection server-side; no browser-only truth
- No fabricated attendance or external confirmations

## Interfaces

- `createMeeting`, `rescheduleMeeting`, `cancelMeeting`, `recordAttendance`
- `listCalendarEvents`, `detectCalendarConflicts`, `exportIcs`, `getCalendarIntegrationStatus`

## Acceptance

- [ ] Meeting numbers; timezone explicit; end-before-start blocked
- [ ] RSVP distinct from attendance; no fabricated attendance
- [ ] Conflict detect; ICS export; Google/Outlook NOT_CONNECTED
- [ ] Activity-linked Meeting fail-closed
- [ ] Vitest PASS (Wave 3 + prior activity suites)

## Report

`.superpowers/sdd/task-p13-3-report.md` — no commit.
