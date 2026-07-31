# Phase 15 Inputs — from Sales Demo Phase 14

**Source exit:** `READY_FOR_PHASE_15_WITH_BLOCKERS` (see `FINAL_PHASE_14_REPORT.md`)  
**Date:** 2026-07-30

## What Phase 15 may consume

| Input | Location / contract | Notes |
|-------|---------------------|-------|
| CrmDemoRequest / CrmDemo spine | `lib/admin/crm/demos/*` | `DMR-` / `DEMO-YYYY-######`; Demo ≠ Meeting |
| Schedule substrate | Meeting + Calendar via Phase 13 | Required on Demo schedule; times reconcile |
| Agenda / Script / Scenario / Content | versioned + SoD; restricted projections | ACTIVE immutable; customer-safe vs RESTRICTED |
| Logical Demo Environment | `environments.js` / DENV | READY only via approved provision + health; cloud `NOT_AVAILABLE` |
| Safe data packs | `dataPacks.js` | Production/credentials rejected |
| Checklist / rehearsal | Critical fails block readiness when configured | Opt-in gates |
| Delivery session | `delivery.js` | Meeting COMPLETED ≠ DELIVERED |
| Source-backed attendance | `attendance.js` | RSVP ≠ attendance |
| Recording governance | `recording.js` | request/consent/approve/deny; provider `NOT_AVAILABLE` |
| Feedback / Outcome | `feedback.js`, `outcomes.js` | Completeness ≠ success; never auto Opp mutation |
| Follow-Up | `demos/followUps.js` → Phase 13 | Consent-blocked never auto-run |
| Proposal handoff payload | `emitDemoProposalHandoff` | Idempotent; `proposalCreated: false` |
| Trial handoff payload | `emitDemoTrialHandoff` | Idempotent; no Trial/Tenant create |
| Demo reports + schedules | `reports.js`, `reportSchedules.js` | EMPTY/UNAVAILABLE on gate fail |
| Opportunity proposal readiness | Phase 12 `proposalReadiness.js` | Orthogonal handoff eval — CORRECT_AND_REUSABLE |
| Activity / Task / Call / Email / Meeting | Phase 13 | Reminder delivery ≠ Activity complete |

## What Phase 15 must not assume

- Live recording media / files are available
- Real cloud/container Demo environments are provisioned
- Proposal/Quotation/e-sign already created from Demo handoff
- Trial or Production Tenant already provisioned from Demo
- Demo outcome already changed Opportunity stage / probability / close date
- Telephony CONNECTED or Google/Outlook calendar sync live
- Email/WhatsApp inbound Lead volume exists
- Weighted Pipeline UI/report totals are enabled (Phase 16)
- Owner/team/territory scope filtering is fully implemented (`resolveCrmScope` stub)
- Rich Demo UI hubs beyond thin stubs

## Suggested Phase 15 scope seeds

1. **Proposal / Quotation create** from READY Proposal handoff (human-gated; SoD as designed)
2. Optional: e-sign / contract foundations (if Phase 15 owns them)
3. Optional: Trial create from Trial handoff (still ≠ Production Tenant)
4. Conversion / Tenant create transaction remains human-gated (never silent from Demo/Closed Won)
5. Harden owner/team/territory scope filtering across Demo + Opportunity lists
6. Keep weighted UI dark unless Phase 16 is pulled forward intentionally
7. Optional: deepen recording provider contract without fabricating media

## Carry gaps (from Phase 14 + earlier)

- Recording media provider → later / provider wave
- Real cloud Demo infra → later / infra wave
- Telephony + Call recording → later / provider wave
- Google/Outlook sync → later / provider wave
- Email/WhatsApp Lead ingest → later
- Scope filtering stub → harden in ops waves
- Proposal/Quotation/Trial/Tenant create → Phase 15+ human-gated transactions
- Full sequences / AI communications → out of foundation scope
- Weighted Pipeline UI → Phase 16
- Prisma EPERM on Windows generate/push → SQL fallback available
- Rich Demo UI hubs → product polish waves

## Honesty gates to preserve

- Empty Demo report ≠ invent zeroes
- RSVP ≠ attendance; UNKNOWN consent ≠ GRANTED
- Meeting COMPLETED ≠ Demo DELIVERED
- Outcome completeness ≠ success; never auto Opportunity mutation
- Proposal/Trial handoff ≠ create
- Closed Won / Demo never provisions Tenant / Subscription / Invoice
- Logical env READY never invented; Production data packs rejected
- No fabricated telephony CONNECTED / external calendar Events / recording files
- Score / probability remain explainable — not ML certainty / not Revenue
