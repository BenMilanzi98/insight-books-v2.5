# Phase 13 — Sales Activity & Engagement

**Surface:** `/insightbooks/crm/activities` (+ tasks, follow-ups, calls, emails, meetings, calendar, notes, reminders, activity-reports)  
**Architecture:** Extend `lib/admin/crm/*` — canonical `CrmActivity` parent + typed children  
**Design:** `docs/superpowers/specs/2026-07-30-sales-activity-phase-13-design.md`  
**Plan:** `docs/superpowers/plans/2026-07-30-sales-activity-phase-13.md`  
**Handoff in:** `docs/admin-intelligence-crm/phase-12/PHASE_13_INPUTS.md`  
**Phase 12 exit:** `READY_FOR_PHASE_13_WITH_BLOCKERS`

## Wave status

| Wave | Focus | Status |
|------|-------|--------|
| 0 | Forensic audits + matrices + CONDITIONAL GO | Complete (2026-07-30) |
| 1 | Canonical Activity + Task/Note migrate; Follow-Up + Next-Action; timeline | Pending |
| 2 | Call (manual/planned) + Email SMTP Activity + email template foundations | Pending |
| 3 | Meeting + internal Calendar + availability/conflict + ICS; Google/Outlook NOT_CONNECTED | Pending |
| 4 | Reminders; templates; automation foundations; reporting centre + schedules; Phase 14 pack | Pending |

**Phase exit (expected):** `READY_FOR_PHASE_14_WITH_BLOCKERS`  
**Skip until Wave 4:** `PHASE_14_READINESS_CHECKLIST.md`

## Hard rules

- Activity ≠ Audit Event ≠ Analytics Event
- Task ≠ Call ≠ Meeting ≠ Demo; Note ≠ outbound communication; Meeting ≠ Demo
- One Activity record; many timeline projections — do not duplicate Activities per entity view
- Planned ≠ completed; due-date pass ≠ complete; reminder ≠ Sales contact; RSVP ≠ attendance; SMTP accept ≠ delivered
- Outbound Call / Email / invitation requires server eligibility + persisted decision; UNKNOWN consent ≠ granted
- No fabricated Activities, deliveries, replies, Meetings, attendance, or external calendar Events
- No AI communications; Call recording NOT_AVAILABLE; no undisclosed tracking pixels
- Telephony provider boundary NOT_AVAILABLE; Google / Outlook NOT_CONNECTED
- Automation foundations only — no full sales sequences; no arbitrary code
- Owner / team / territory scope server-side; restricted Notes never on Customer APIs / default exports
- CoA admin route stays removed; no Tenant GL / payment / MRA secret exposure
- Support/CS tasks, SupportSlaCalendar, analytics-pipeline, Tenant POS `sales.*` are WRONG_DOMAIN

## Classification legend

| Class | Meaning |
|-------|---------|
| READY | Usable as-designed for Phase 13 consumption |
| PARTIAL | Exists but incomplete / not Activity-shaped |
| FOUNDATION | Thin foundations present; needs Wave work |
| NOT_FOUND | Absent in codebase / schema |
| WRONG_DOMAIN | Exists but belongs to another plane |
| NOT_AVAILABLE | Explicitly deferred with contract |
| NOT_CONNECTED | External integration contract present; sync not live |
| BLOCKED | Cannot proceed until dependency cleared |
| CORRECT_AND_REUSABLE | Keep as boundary / input; do not redefine |
| EXTEND | Reuse and extend under Activity spine |
| FORBIDDEN | Must not be reused as Sales Activity truth |

