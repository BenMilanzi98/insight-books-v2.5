# Current Training Session Audit

**Audited:** 2026-07-31  
**Lens:** PRD Phase 22 Customer Training (tree phase-18 code alias)

| Check | Class | Evidence |
|-------|-------|----------|
| Session create + TRS numbering | CORRECT_AND_REUSABLE / EXTEND | `sessions.js` — TRAINING_SESSION_NUMBER_RE = /^TRS-/ |
| PRD SES- prefix | COMPATIBILITY | Design: prefer TRS-; SES- only via alias if dual codes — Wave 0 documents TRS- as actual |
| CrmMeeting link | CORRECT_AND_REUSABLE / EXTEND | crmMeetingId; MEETING_SERVICE_UNAVAILABLE fail-closed |
| RSVP summary vs attendance | CORRECT_AND_REUSABLE | rsvpSummaryJson distinct from attendanceSummaryJson |
| Virtual provider | CARRY | VIRTUAL_PROVIDER_NOT_CONFIGURED in catalogue |

**Implication:** Sessions reusable with TRS- prefix; Wave 3 hardens delivery evidence vs schedule-alone COMPLETED.

