# Task P13-3 Review — Wave 3 Meetings + internal Calendar + conflicts + ICS

**Mode:** REVIEW  
**Head:** `WORKING_TREE` (no commit, per brief)  
**Diff:** `.superpowers/sdd/task-p13-3-review-package.diff` (+ working-tree Prisma/catalogue/index/nav/locale wiring claimed in report)  
**Brief / report:** `task-p13-3-brief.md` / `task-p13-3-report.md`  
**Read-only** (spec compliance + code quality; vitest re-run)  
**Date:** 2026-07-30  

**Vitest (re-run):**  
- `activityWave3` + `activityWave2` + `activityWave1` → **3 files, 25/25 passed**

---

### Spec Compliance

| Criterion | Status | Notes |
|-----------|--------|-------|
| Meeting numbers `MEET-YYYY-######` | ✅ | `allocateMeetingNumber` → `CRM_NUMBER_PREFIX.MEET`; regex + unique; create path allocates before persist. |
| Timezone explicit | ✅ | `timezone_required` when missing/blank on create + calendar event; UTC store + optional `startsAtOriginal` / `endsAtOriginal`; reschedule keeps/requires timezone. |
| End-before-start blocked | ✅ | `endsAtUtc <= startsAtUtc` → `end_before_start` on create, reschedule, conflict detect, calendar create; no Meeting create (tested). |
| RSVP ≠ attendance; no fabricated attendance | ✅ | `recordMeetingRsvp` updates RSVP only; participants default `UNKNOWN`; `recordAttendance` needs edit auth + confirmed status; `fromRsvpAlone: false` / `fabricatedAttendance: false`. |
| Conflict detect server-side BLOCK/WARN/ALLOW_WITH_REASON | ✅ | `detectCalendarConflicts` + `applyConflictPolicy` on create/reschedule; reason required for ALLOW_WITH_REASON; not browser-only. |
| ICS export | ✅ | `exportIcs` VCALENDAR/VEVENT UTC; `externalSync: false`; API `text/calendar` + `X-CRM-External-Sync: false`. |
| Google/Outlook NOT_CONNECTED | ✅ | `CRM_CALENDAR_INTEGRATION_STATUS = 'NOT_CONNECTED'`; status helpers set `externalEventsFabricated: false`. |
| Activity-linked Meeting fail-closed | ✅ | Activity create failure returns before `crmMeeting.create` / calendar create (tested). |
| Outbound invitations Contact + eligibility | ✅ | `sendInvitations` → `CONTACT_REQUIRED`; DNC/consent → `BLOCKED_BY_CONSENT`; `invitationSent: false` (no fabricated send). |
| Prisma + SQL + model guards | ✅ | Schema models + `scripts/sql/crm-activity-phase13-wave3.sql` + `hasCrm*Model` (schema/catalogue wiring in WT; package focuses on services/SQL/tests/APIs/UI). |
| APIs + thin UI stubs | ✅ | Meetings + action routes; calendar list/conflicts/ICS/integrations; hubs `/insightbooks/crm/meetings` + calendar day/week/month/agenda stubs. |
| Required interfaces | ✅ | `createMeeting`, `rescheduleMeeting`, `cancelMeeting`, `recordAttendance`, `listCalendarEvents`, `detectCalendarConflicts`, `exportIcs`, `getCalendarIntegrationStatus` (+ numbering/RSVP/conflict policy helpers). |
| No live Google/Outlook; no Demo / SupportSlaCalendar alias | ✅ | Typed NOT_CONNECTED; SQL/comments forbid alias. |
| Vitest Wave 3 claimed PASS | ✅ | Re-run **25/25** (Wave 3 + prior activity suites). |
| No git commit | ✅ | Per brief/report. |

---

### Verify checklist (detailed)

1. **Timezone explicit; end-before-start blocked** — Create/reschedule/calendar/conflicts reject blank timezone and `endsAt <= startsAt`; happy path stores IANA timezone + optional original wall times.
2. **RSVP ≠ attendance; no fabricated attendance** — ACCEPTED leaves attendance `UNKNOWN`; viewer cannot record attendance; authorised `recordAttendance` leaves RSVP unchanged and sets `fromRsvpAlone: false`.
3. **Conflicts server-side; ICS; Google/Outlook NOT_CONNECTED** — BLOCK/WARN/ALLOW_WITH_REASON exercised in Wave 3; ICS download-only; integrations contract never fabricates external Events.
4. **Activity fail-closed** — Forced Activity numbering failure → no Meeting/Calendar create.
5. **Vitest claimed PASS** — Confirmed **25/25**.

---

### Strengths

- Clear honesty boundaries: RSVP/attendance split, `invitationSent: false`, `externalSync: false`, NOT_CONNECTED contract on Meeting and Calendar surfaces.
- Conflict policy is enforced in the Meeting write path (not only a read API).
- Cancel Follow-Up hook is opt-in (`createFollowUp: true`) and never auto-executed.
- Availability mode hides private titles (`Busy` + `privateDetailsHidden`) without inventing external busy data.

---

### Issues

#### Critical (Must Fix)

_None._

#### Important (Should Fix)

_None._

#### Minor (Nice to Have)

1. **Calendar create failure after Activity+Meeting** — If `createCalendarEventForMeeting` fails (including calendar model unavailable), Meeting is best-effort cancelled but the CrmActivity remains (and Meeting number may be burned). Prefer fail before Activity/Meeting persist, or compensate Activity cancel; soft-skip calendar when model absent (mirror Activity EPERM pattern).
2. **Review package omits Prisma/catalogue/index/nav/locale diffs** — Working tree has them; package is service/SQL/test/API/UI-centric. Future packages should include catalogue + schema for review completeness.
3. **Prisma generate not run** — Report concern; model guards + SQL mitigate EPERM.
4. **UI hubs are stubs** — Expected; APIs live.
5. **Invitation delivery foundation only** — Eligibility + REQUESTED/BLOCKED statuses; no live invite SMTP (in scope).
6. **Timezone not IANA-validated** — Non-empty string accepted; brief requires explicit timezone, not registry validation.
7. **Week/month/agenda list paths lightly tested** — Range helpers exist; Wave 3 list test covers `day` only.

---

### Acceptance checklist (brief)

- [x] Meeting numbers; timezone explicit; end-before-start blocked
- [x] RSVP distinct from attendance; no fabricated attendance
- [x] Conflict detect; ICS export; Google/Outlook NOT_CONNECTED
- [x] Activity-linked Meeting fail-closed
- [x] Vitest PASS (Wave 3 + prior activity suites) — 25/25
- [x] No live Google/Outlook sync / fabricated attendance / Demo alias / git commit

---

### Assessment

Wave 3 meets the brief: explicit timezone and end-before-start guards, RSVP/attendance honesty, server-side conflict policies, ICS export without external sync, typed Google/Outlook `NOT_CONNECTED`, and Activity create fail-closed before Meeting persist. Vitest re-run is 25/25. Remaining items are minor/non-blocking. Ready to proceed.

**Task quality:** Approved
