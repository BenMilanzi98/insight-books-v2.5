# Phase 14 Readiness Checklist — from Phase 13

**Exit decision:** `READY_FOR_PHASE_14_WITH_BLOCKERS`  
**Date:** 2026-07-30

## Must be true before Phase 14 consumes Activity plane

- [x] Canonical CrmActivity parent with numbering (`ACT-YYYY-######`)
- [x] Task / Follow-Up / Note under Activity (CsTask never aliased)
- [x] Call manual/planned path; telephony typed `NOT_AVAILABLE`
- [x] Email Activity SMTP path; accept ≠ delivered; no fabricated opens/replies/pixels
- [x] Meeting + internal Calendar + ICS; RSVP ≠ attendance; Google/Outlook `NOT_CONNECTED`
- [x] Reminder dedupe (rule+activity+recipient+occurrence+channel); delivery ≠ Activity complete
- [x] Versioned Activity/Task templates; ACTIVE not directly editable
- [x] Automation foundations: SoD approve, idempotent execute, small approved trigger set only
- [x] Activity reports honesty-gated; schedules create/list/run audited
- [x] DQ + Activity recon foundations never invent zeroes on gate failure
- [x] Lead/Opportunity Activity projection panels (thin OK)
- [x] Foundations: `ACTIVITY_SPINE` READY; Email/WhatsApp ingest NOT_AVAILABLE; weighted UI dark
- [x] Wave 4 + prior activity Vitest suites green (WORKING_TREE)
- [x] `FINAL_PHASE_13_REPORT.md` + `PHASE_14_INPUTS.md` written

## Explicit carry blockers (document in Phase 14 scope)

- [ ] Telephony / Call recording (NOT_AVAILABLE)
- [ ] Google / Outlook calendar sync (NOT_CONNECTED)
- [ ] Email / WhatsApp Lead ingest
- [ ] Owner/team/territory scope filtering beyond stub
- [ ] Demo management (deferred to Phase 14)
- [ ] Proposal create / Tenant conversion transaction (handoffs only today)
- [ ] Full sales sequences / AI communications (forbidden in foundations)
- [ ] Weighted Pipeline UI/reports (Phase 16)
- [ ] Windows Prisma EPERM (SQL fallback available)
- [ ] Rich Activity UI hubs beyond thin stubs

## Do not start Phase 14 work that assumes

- Live dialer or recording is available
- External calendar sync already works
- Reminder delivery completed Activities
- Automation sequences run without SoD
- Closed Won / Activity already created billing objects
- Demo was shipped as a Meeting subtype in Phase 13
- Silent multi-currency or fabricated Activity volume KPIs
