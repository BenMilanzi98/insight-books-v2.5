# Phase 15 Readiness Checklist — from Phase 14

**Exit decision:** `READY_FOR_PHASE_15_WITH_BLOCKERS`  
**Date:** 2026-07-30

## Must be true before Phase 15 consumes Demo plane

- [x] CrmDemoRequest (`DMR-YYYY-######`) + qualify/convert idempotent
- [x] CrmDemo (`DEMO-YYYY-######`) first-class; Demo ≠ Meeting ≠ Trial ≠ Proposal
- [x] Schedule requires CrmMeeting + Calendar Event; times reconcile; Google/Outlook `NOT_CONNECTED`
- [x] Participants / presenters; RSVP ≠ attendance
- [x] Versioned Agenda/Script/Scenario/Content; ACTIVE immutable; SoD approve; restricted never on Customer
- [x] Logical Demo Environment (DENV); READY only via approved provision + health; expiry + DEMO banner
- [x] Safe data packs; Production data/credentials rejected
- [x] Checklist / rehearsal; Critical fails block readiness when configured
- [x] Delivery session; Meeting COMPLETED ≠ Demo DELIVERED
- [x] Source-backed Demo attendance; invent-from-RSVP forbidden
- [x] Recording governance only; provider `NOT_AVAILABLE`; no fabricated media
- [x] Feedback forms/responses; never invent scores
- [x] Outcome + completeness ≠ success; never auto Opportunity stage/probability/close-date
- [x] Follow-Ups via Phase 13; never auto-executed when consent-blocked
- [x] Proposal + Trial handoff payloads idempotent; never create Proposal/Trial/Tenant
- [x] Demo reports honesty-gated; schedules create/list/run audited
- [x] Foundations: `DEMO_SPINE` READY; recording/cloud infra stay `NOT_AVAILABLE`; weighted UI dark
- [x] Wave 4 + prior demo Vitest suites green (WORKING_TREE)
- [x] `FINAL_PHASE_14_REPORT.md` + `PHASE_15_INPUTS.md` written

## Explicit carry blockers (document in Phase 15 scope)

- [ ] Recording media provider (NOT_AVAILABLE — governance only today)
- [ ] Real cloud / container Demo infra (logical only)
- [ ] Proposal / Quotation / e-sign / contracts create (handoffs only today)
- [ ] Full Trial management / Trial provision
- [ ] Production Tenant / Subscription / Invoice / Payment provision
- [ ] Telephony / Call recording (NOT_AVAILABLE)
- [ ] Google / Outlook calendar sync (NOT_CONNECTED)
- [ ] Email / WhatsApp Lead ingest
- [ ] Owner/team/territory scope filtering beyond stub
- [ ] Weighted Pipeline UI/reports (Phase 16)
- [ ] Windows Prisma EPERM (SQL fallback available)
- [ ] Rich Demo UI hubs beyond thin stubs
- [ ] AI scripts / answers / summaries (forbidden in foundations)

## Do not start Phase 15 work that assumes

- Live recording files already exist from Demo governance approve
- Cloud Demo environments are Production-connected
- Demo outcome already moved Opportunity stage / probability / close date
- Proposal/Trial/Tenant already created from handoff emission
- Reminder delivery completed Activities / Follow-Ups
- Closed Won / Demo already created billing objects
- Silent multi-currency or fabricated Demo volume KPIs from Lead `DEMO_REQUEST` counts alone
