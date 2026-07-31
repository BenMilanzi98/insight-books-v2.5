# Demo Domain Matrix

| Concept | Canonical plane | Alias risk | Class |
|---------|-----------------|------------|-------|
| CrmDemoRequest (DMR) | Phase 14 Demo | Lead-as-DMR forever | FOUNDATION Lead → EXTEND Wave 1 |
| CrmDemo (DEMO) | Phase 14 Demo | Meeting-as-Demo | NOT_FOUND → Wave 1 |
| CrmMeeting | Phase 13 Activity | Demo without Meeting when scheduled | EXTEND schedule |
| Calendar Event | Phase 13 | External Google Event as truth | NOT_CONNECTED / EXTEND ICS |
| Demo Environment (DENV) | Phase 14 logical | MRA EIS sandbox / Production Tenant | NOT_FOUND; alias FORBIDDEN |
| Demo Data Pack | Phase 14 | Production clone / FP pilot data | NOT_FOUND; clone FORBIDDEN |
| Agenda / Script / Content | Phase 14 | Email/Activity templates | NOT_FOUND; templates = pattern only |
| Checklist / Rehearsal | Phase 14 | Proposal readiness checklist | NOT_FOUND; distinct |
| Attendance | Phase 14 (+ Meeting confirm pattern) | RSVP-as-attended | Meeting rule CORRECT_AND_REUSABLE |
| Recording governance | Phase 14 | Call recording / media files | NOT_AVAILABLE provider |
| Feedback / Outcome | Phase 14 | Win probability / Closed Won | NOT_FOUND; auto-mutate FORBIDDEN |
| Follow-Up | Phase 13 | Reminder / CsTask | EXTEND Follow-Up |
| Proposal / Trial | Phase 15 / later | Create from Demo | Handoff CORRECT_AND_REUSABLE |
| Opportunity | Phase 12 | Stage auto-change from outcome | Boundary CORRECT_AND_REUSABLE |
| CsTask / Support | CS / Support | Demo task alias | WRONG_DOMAIN |
| Tenant POS sales | Tenant | Demo sales | WRONG_DOMAIN |
| analytics-pipeline | Ops | Demo KPI | WRONG_DOMAIN |
