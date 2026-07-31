# Phase 13 Scope

**Date:** 2026-07-30  
**Approach:** B (Wave 0 forensic → spine → channels → calendar → ops)

## In scope

1. Canonical `CrmActivity` parent (`ACT-YYYY-######`) + typed children: Task, Follow-Up, Call, Email Activity, Meeting, Calendar Event, Note relation
2. Migrate existing Phase 11/12 `CrmTask` / `CrmNote` under Activity (no competing task domains)
3. Follow-Up + Next-Action / no-next-action detection (Lead + Opportunity)
4. Manual + planned Calls; telephony provider typed **NOT_AVAILABLE**; recording **NOT_AVAILABLE**
5. Email Activity with real SMTP send via `lib/email.js` / `lib/emailService.js`; accept ≠ delivered; no fabricated opens/replies
6. Meetings + internal Calendar (day/week/month/agenda), working hours, availability, conflict policy, ICS export
7. Google / Outlook calendar sync contracts → **NOT_CONNECTED** (no fabricated sync)
8. Reminders (dedupe); activity/task templates (versioned); automation foundations (SoD + small trigger set)
9. Activity reporting centre + schedules with honesty gates
10. Consent / DNC / eligibility enforcement on outbound channels; timezone-explicit scheduling
11. Entity panels: Lead / Account / Contact / Opportunity activities
12. Exit pack: `READY_FOR_PHASE_14_WITH_BLOCKERS` + Phase 14 inputs/checklist

## Out of scope (explicit)

- Complete Demo Management (Phase 14)
- Proposal / Quotation / e-sign / contracts
- Tenant / Customer / Subscription / Invoice / Payment creation (Closed Won ≠ provision)
- Full sales sequences / cadences
- AI-generated emails / scripts / summaries / next-actions
- Live telephony / dialer / call recording stack
- Google / Outlook live sync
- WhatsApp provider / Email→Lead ingest (remain NOT_AVAILABLE)
- Undisclosed tracking pixels
- Sales quotas / commissions
- Accounting / billing / MRA fiscal changes; System CoA admin
- Weighted Pipeline UI (Phase 16)

## Carry blockers (from Phase 12 — document, do not silently clear)

| Carry | Status |
|-------|--------|
| Weighted Pipeline UI/reports | Phase 16 — dark |
| `resolveCrmScope` owner/team/territory stub (`mode: 'all'`) | Harden in-phase where Activity lists need it |
| Account / Contact merge | NOT_AVAILABLE |
| Email / WhatsApp Lead ingest | NOT_AVAILABLE |
| Lead/Opportunity → Tenant conversion transaction | CARRY (Closed Won ≠ provision) |
| Windows Prisma EPERM | SQL + `hasCrm*Model` guards |
| Competitor / partner Opportunity depth | Optional / deferred |

## Surfaces (target)

- UI hubs under `/insightbooks/crm/{activities,tasks,follow-ups,calls,emails,meetings,calendar,notes,reminders}`
- APIs under `app/api/admin/crm/{activities,tasks,follow-ups,calls,emails,meetings,calendar,reminders,…}`
- Libs under `lib/admin/crm/{activities,followUps,calls,emails,meetings,calendar,reminders,automation,…}`

