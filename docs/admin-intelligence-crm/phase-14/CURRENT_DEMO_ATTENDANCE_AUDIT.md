# Current Demo Attendance Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Demo attendance records | NOT_FOUND | No Demo attendance plane |
| Source-backed attendance rule | NOT_FOUND (design locked) | Must not fabricate |
| Meeting RSVP ≠ attendance | CORRECT_AND_REUSABLE | `catalogue.js` CRM_MEETING_RSVP; `meetings/service.js` `recordRsvp` vs authorised attendance; inventAttendanceFromRsvpForbidden in foundations |
| Meeting attendance confirm | EXTEND pattern | Authorised confirmation API path — pattern for Demo; Demo attendance remains separate entity |
| Fabricated attendance import | FORBIDDEN | Must remain forbidden |

**Implication:** Wave 4 Demo attendance source-backed; may project from authorised Meeting attendance when linked, but RSVP alone never marks attended.
