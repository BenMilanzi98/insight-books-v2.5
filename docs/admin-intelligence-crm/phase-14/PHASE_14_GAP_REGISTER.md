# Phase 14 Gap Register

**Audited:** 2026-07-30  
**Inputs:** Phase 13 `PHASE_14_INPUTS.md`, `FINAL_PHASE_13_REPORT.md`, Wave 0 audits, design/plan

| ID | Gap | Severity | Wave | Notes |
|----|-----|----------|------|-------|
| G14-01 | No CrmDemoRequest / DMR numbering | BLOCKER | 1 | Greenfield under `lib/admin/crm/demos/*` |
| G14-02 | No CrmDemo / DEMO numbering | BLOCKER | 1 | First-class; Meeting ≠ Demo |
| G14-03 | No qualify/convert Demo Request (idempotent) | BLOCKER | 1 | Lead DEMO_REQUEST is FOUNDATION intake only |
| G14-04 | No scheduleDemo → Meeting + Calendar reconcile | BLOCKER | 1 | Reuse P13 meetings/calendar |
| G14-05 | No Demo participants / presenters / readiness spine | BLOCKER | 1 | RSVP ≠ attendance |
| G14-06 | No Demo hub UI/APIs | HIGH | 1 stubs → later | `/insightbooks/crm/demos`, demo-requests APIs |
| G14-07 | No Opportunity/Lead Demo projections | MEDIUM | 1 | Thin panels OK |
| G14-08 | No versioned Agenda / Script / Scenario / Content | BLOCKER | 2 | ACTIVE not directly editable; pin versions |
| G14-09 | No restricted Script projection controls | HIGH | 2 | Never Customer/invite/default export |
| G14-10 | No en/ny script foundations | MEDIUM | 2 | Foundations only |
| G14-11 | No logical Demo Environment / DENV | BLOCKER | 3 | No cloud fabricate; no Production clone |
| G14-12 | No safe data packs + Production-data detection | BLOCKER | 3 | Reject Production credentials/data |
| G14-13 | No checklist / rehearsal readiness gates | HIGH | 3 | Critical fail blocks READY_TO_DELIVER |
| G14-14 | No provision/reset/expiry idempotency + DEMO banner | HIGH | 3 | Expiry required |
| G14-15 | No delivery session / questions / live issues | HIGH | 4 | Meeting COMPLETED ≠ delivered |
| G14-16 | No source-backed Demo attendance | HIGH | 4 | Never from RSVP alone |
| G14-17 | No recording governance | HIGH | 4 | Provider NOT_AVAILABLE; default OFF |
| G14-18 | No feedback / outcome (≠ auto Opp mutation) | HIGH | 4 | Handoffs only for Proposal/Trial |
| G14-19 | No Demo → Follow-Up bridge | MEDIUM | 4 | Use P13 followUps |
| G14-20 | No Demo reports + schedules | HIGH | 4 | Honesty gates; no false zeroes |
| G14-21 | MRA EIS sandbox alias risk | PROCESS | All | WRONG_DOMAIN docs + guards |
| G14-22 | resolveCrmScope stub | CARRY | Harden in-phase | `mode: 'all'` |
| G14-23 | Telephony / Google-Outlook / ingest | CARRY | Orthogonal | NOT_AVAILABLE / NOT_CONNECTED |
| G14-24 | Proposal/Tenant create transactions | CARRY | Phase 15+ | Handoff payloads only |
| G14-25 | Weighted Pipeline UI | DEFERRED | Phase 16 | Unrelated to Demo core |
| G14-26 | Prisma EPERM on Windows | CARRY | All | SQL + hasCrm*Model guards |
| G14-27 | Recording media provider / real cloud infra | CARRY | Later | NOT_AVAILABLE this phase |
| G14-28 | Rich UI hubs beyond thin stubs | MEDIUM | 1–4 | Match P13 thin-stub acceptable pattern |

**No TBD blocking Wave 1 after CONDITIONAL GO** — Lead DEMO_REQUEST / REQUEST_DEMO capture, Meeting/Calendar schedule substrate, consent/eligibility, Opportunity handoff boundaries, and approved design are sufficient to start Demo Request + Demo spine; content/env/delivery/reports follow Waves 2–4.
