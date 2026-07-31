# Phase 13 Gap Register

**Audited:** 2026-07-30  
**Inputs:** Phase 12 `PHASE_13_INPUTS.md`, `FINAL_PHASE_12_REPORT.md`, Wave 0 audits, design/plan

| ID | Gap | Severity | Wave | Notes |
|----|-----|----------|------|-------|
| G13-01 | No CrmActivity parent / ACT numbering | BLOCKER | 1 | Greenfield under `lib/admin/crm/activities/*` |
| G13-02 | CrmTask/CrmNote not linked to Activity | BLOCKER | 1 | Migrate/link; no competing domains |
| G13-03 | No Follow-Up / Next-Action / no-next-action | BLOCKER | 1 | Lead + Opportunity |
| G13-04 | No Activity hub UI/APIs | HIGH | 1 stubs → later | `/activities`, my-work, detail |
| G13-05 | Timeline lacks Activity-typed events | MEDIUM | 1 | Extend event types; one Activity many projections |
| G13-06 | No CrmCall + telephony boundary contract | BLOCKER | 2 | Manual/planned; telephony NOT_AVAILABLE |
| G13-07 | No CrmEmailActivity + SMTP send-request | BLOCKER | 2 | Adapter over `lib/email*`; accept ≠ delivered |
| G13-08 | No Sales email template governance | HIGH | 2 foundations | Versioned; no executable expressions |
| G13-09 | No CrmMeeting / participants / attendance | BLOCKER | 3 | RSVP ≠ attendance; Meeting ≠ Demo |
| G13-10 | No internal CRM calendar + ICS | BLOCKER | 3 | Google/Outlook NOT_CONNECTED |
| G13-11 | No working hours / availability / conflict | HIGH | 3 | Do not reuse SupportSlaCalendar |
| G13-12 | No Activity timezone model | HIGH | 1–3 | UTC + display + original |
| G13-13 | No CrmReminder dedupe/snooze | HIGH | 4 | Reminder ≠ contact / ≠ complete |
| G13-14 | No Activity/task templates | MEDIUM | 4 | Active not directly editable |
| G13-15 | No automation foundations | HIGH | 4 | SoD + small triggers; no sequences |
| G13-16 | No Activity reports + schedules | HIGH | 4 | Honesty gates; no false zeroes |
| G13-17 | Eligibility not persisted on outbound Actions | HIGH | 2–3 | Gate exists; consumers missing |
| G13-18 | resolveCrmScope stub | CARRY | Harden in-phase | `mode: 'all'` |
| G13-19 | Email/WhatsApp Lead ingest | CARRY | Orthogonal | NOT_AVAILABLE |
| G13-20 | Weighted Pipeline UI | DEFERRED | Phase 16 | Unrelated to Activity core |
| G13-21 | Account/Contact merge | CARRY | — | NOT_AVAILABLE |
| G13-22 | Conversion ≠ Closed Won provision | CARRY | — | Do not provision from Activity |
| G13-23 | CsTask / SupportSlaCalendar alias risk | PROCESS | All | WRONG_DOMAIN docs + guards |
| G13-24 | Prisma EPERM on Windows | CARRY | All | SQL + hasCrm*Model guards |
| G13-25 | Task checklist/deps/recurrence depth | MEDIUM | 1 foundations / later | Per plan scope |

**No TBD blocking Wave 1 after CONDITIONAL GO** — Task/Note/timeline/consent/eligibility + approved design are sufficient to start Activity spine; channels/calendar/automation/reports follow Waves 2–4.

