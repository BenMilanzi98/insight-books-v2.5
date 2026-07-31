# Phase 13 Readiness Checklist — from Phase 12

**Exit decision:** `READY_FOR_PHASE_13_WITH_BLOCKERS`  
**Date:** 2026-07-30

## Must be true before Phase 13 consumes Pipeline/Opportunity

- [x] ACTIVE catalogue Pipelines: `NEW_BUSINESS`, `EXPANSION`, `MRA_EIS` (versioned)
- [x] Opportunity create from READY handoff is idempotent
- [x] Stage transitions server-governed with immutable history
- [x] Closed Won evidence path exists and does **not** provision Tenant/Subscription/Invoice
- [x] Proposal / conversion readiness are handoff payloads only
- [x] Opportunity duplicate candidates + SoD merge (no silent merge)
- [x] Opportunity import preview/confirm with idempotency + honesty gates
- [x] Pipeline reports currency-separated; empty → EMPTY/UNAVAILABLE (no false zeroes)
- [x] Report schedules create/list/run audited
- [x] `WEIGHTED_PIPELINE_UI_ENABLED === false`
- [x] Foundations: Opportunity IMPORT / REPORTING / OPPORTUNITY_PIPELINE honest READY; Email/WhatsApp NOT_AVAILABLE
- [x] Wave 4 + prior opportunity Vitest suites green (WORKING_TREE)

## Explicit carry blockers (document in Phase 13 scope)

- [ ] Weighted Pipeline UI/reports (Phase 16)
- [ ] Owner/team/territory scope filtering beyond stub
- [ ] Optional competitor/partner Opportunity depth
- [ ] Account/Contact merge (still NOT_AVAILABLE)
- [ ] Email/WhatsApp Lead ingest
- [ ] Lead/Opportunity → Tenant conversion transaction (Closed Won ≠ provision)
- [ ] Windows Prisma EPERM (SQL fallback available)

## Do not start Phase 13 work that assumes

- Weighted forecasting UI is live
- Closed Won already created billing objects
- Opportunity value is contracted MRR/ARR
- Silent multi-currency grand totals
