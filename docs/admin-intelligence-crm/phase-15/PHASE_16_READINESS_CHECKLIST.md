# Phase 16 Readiness Checklist — from Phase 15

**Exit decision:** `READY_FOR_PHASE_16_WITH_BLOCKERS`  
**Date:** 2026-07-31

## Must be true before Phase 16 consumes commercial plane

- [x] CrmProposalRequest (`PRQ-YYYY-######`) + Demo/Opp convert idempotent
- [x] CrmCommercialDocument + versioned Proposal/Quotation; Tenant Quotation = WRONG_DOMAIN
- [x] Price Books + pricing/tax/FX/discounts/exceptions/approvals with SoD
- [x] Templates/branding + deterministic PDF + checksum + private storage
- [x] Issue / delivery / review access; delivery ≠ view ≠ acceptance
- [x] Acceptance binds version + checksum + authority; rejection / expiry / supersession
- [x] E-sign boundary explicit `NOT_CONFIGURED` (never fabricated)
- [x] Closed-Won readiness evaluation (`evaluateClosedWonReadiness`)
- [x] Phase 16 conversion handoff idempotent; creates nothing
- [x] Never auto-mutate Opportunity stage / probability / close date from commercial actions
- [x] Commercial reports honesty-gated; currency-separated overview
- [x] DQ + reconciliation runners; gate fail ≠ fabricated zero
- [x] Foundations: `COMMERCIAL_SPINE` READY; e-sign stays `NOT_CONFIGURED`; weighted UI dark
- [x] Wave 4 commercial Vitest suite green (WORKING_TREE)
- [x] `FINAL_PHASE_15_REPORT.md` + `PHASE_16_INPUTS.md` written

## Explicit carry blockers (document in Phase 16 scope)

- [ ] E-sign provider (NOT_CONFIGURED — boundary only today)
- [ ] Production Tenant / Subscription / Invoice / Payment provision
- [ ] Weighted Pipeline UI/reports (Phase 16 may enable with honesty gates)
- [ ] Owner/team/territory scope filtering beyond stub
- [ ] Telephony / Call recording (NOT_AVAILABLE)
- [ ] Google / Outlook calendar sync (NOT_CONNECTED)
- [ ] Email / WhatsApp Lead ingest
- [ ] Demo recording media + real cloud Demo infra (NOT_AVAILABLE)
- [ ] Windows Prisma EPERM (SQL fallback available)
- [ ] Rich commercial UI hubs beyond thin stubs
- [ ] AI commercial automation (forbidden in foundations)

## Do not start Phase 16 work that assumes

- E-sign signatures already exist from commercial acceptance
- Customer/Tenant/Subscription/Invoice already created from handoff emission
- Acceptance already moved Opportunity stage / probability / close date
- Silent multi-currency commercial KPI totals are safe to display as one number
- Closed Won already provisioned billing objects
- Fabricated commercial volume KPIs when reliability gate fails
