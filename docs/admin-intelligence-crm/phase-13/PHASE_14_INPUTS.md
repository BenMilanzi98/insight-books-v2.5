# Phase 14 Inputs — from Sales Activity Phase 13

**Source exit:** `READY_FOR_PHASE_14_WITH_BLOCKERS` (see `FINAL_PHASE_13_REPORT.md`)  
**Date:** 2026-07-30

## What Phase 14 may consume

| Input | Location / contract | Notes |
|-------|---------------------|-------|
| CrmActivity spine | `lib/admin/crm/activities/*` | `ACT-YYYY-######`; one Activity; many projections |
| Task / Follow-Up / Next-Action | `tasks.js`, `followUps.js`, `nextAction.js` | Due ≠ complete; consent-blocked never auto-run |
| Call (manual/planned) | `lib/admin/crm/calls/*` | Telephony `NOT_AVAILABLE` |
| Email Activity (SMTP) | `lib/admin/crm/emails/*` | Accept ≠ delivered; no fabricated opens/replies |
| Meeting + Calendar + ICS | `meetings/*`, `calendar/*` | RSVP ≠ attendance; Google/Outlook `NOT_CONNECTED` |
| Reminders | `lib/admin/crm/reminders.js` | Dedupe key; delivery ≠ Activity complete |
| Activity/Task templates | `lib/admin/crm/templates.js` | Versioned; ACTIVE not directly editable |
| Automation foundations | `lib/admin/crm/automation/*` | SoD; idempotent; small approved trigger set |
| Activity reports + schedules | `activities/reports.js`, `reportSchedules.js` | EMPTY/UNAVAILABLE on gate fail |
| Activity DQ / recon | `activities/dataQuality.js`, `reconciliation.js` | Honesty-gated |
| Entity Activity panels | Lead/Opportunity detail + `listEntityActivityProjections` | Thin projections |
| Foundations | `ACTIVITY_SPINE` READY; Email/WhatsApp ingest NOT_AVAILABLE | |
| Pipeline / Opportunity (P12) | Pipelines, stages, close, readiness handoffs | Closed Won ≠ provision |

## What Phase 14 must not assume

- Live telephony or Call recording is available
- Google/Outlook calendar sync is connected
- Email/WhatsApp inbound Lead volume exists
- Full sales sequences or AI communications are enabled
- Weighted Pipeline UI/report totals are enabled (Phase 16)
- Closed Won / Activity already provisions Tenant / Subscription / Invoice
- Owner/team/territory scope filtering is fully implemented (`resolveCrmScope` stub)
- Reminder delivery completed the linked Activity
- Demo management was delivered in Phase 13

## Suggested Phase 14 scope seeds

1. **Demo management** (first-class; never alias Meeting-as-Demo without explicit Demo entity)
2. Proposal create from proposal-readiness handoff (if Phase 14 owns proposals)
3. Conversion / Tenant create transaction from conversion-readiness (human-gated)
4. Harden owner/team/territory Activity + Opportunity scope filtering
5. Optional: deepen calendar provider contracts without fabricating sync
6. Keep weighted UI dark unless Phase 16 is pulled forward intentionally

## Carry gaps (from Phase 13 + earlier)

- Telephony + recording → later / provider wave
- Google/Outlook sync → later / provider wave
- Email/WhatsApp Lead ingest → later
- Scope filtering stub → harden in ops waves
- Demo management → Phase 14 core candidate
- Proposal/Tenant provision → human-gated transactions
- Full sequences / AI comms → out of foundation scope
- Weighted Pipeline UI → Phase 16
- Prisma EPERM on Windows generate/push → SQL fallback available

## Honesty gates to preserve

- Empty Activity/Pipeline report ≠ invent zeroes
- Reminder delivery ≠ Activity complete
- Automation self-approval blocked; executions idempotent
- RSVP ≠ attendance; SMTP accept ≠ delivered
- No fabricated telephony CONNECTED / external calendar Events
- Closed Won ≠ provision
- Score / probability remain explainable — not ML certainty / not Revenue
