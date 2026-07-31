# Phase 17 Readiness Checklist — from Phase 16

**Exit decision:** `READY_FOR_PHASE_17_WITH_BLOCKERS`  
**Date:** 2026-07-31

## Must be true before Phase 17 consumes conversion plane

- [x] CrmConversionRequest (`CVR-YYYY-######`) + Closed-Won handoff consume idempotent
- [x] Durable CrmConversion saga + step durability / resume / exact retry
- [x] Early Closed Won lock via Phase 12; no silent reopen on downstream failure
- [x] Dry run = zero operational side effects
- [x] Customer match/create-link + Tenant/Business/Branch + hash-only invitations
- [x] Subscription/entitlements from accepted snapshot; qty ≤ accepted
- [x] Platform Invoice from snapshot; payment initiation ≠ PAID
- [x] Activation policy engine; Closed Won ≠ ACTIVE
- [x] No Tenant GL journals from conversion
- [x] CS assignment idempotent; no fabricated health
- [x] Onboarding/training/migration/MRA handoffs idempotent; execution NOT_STARTED
- [x] Completion certificate checksum stable; finalize idempotent
- [x] Compensation never deletes acceptance evidence
- [x] Conversion reports honesty-gated; gate fail ≠ fabricated zero
- [x] Weighted Pipeline UI capability unlocked via honesty/currency accessor
- [x] Wave 4 conversion Vitest suite green (WORKING_TREE)
- [x] `FINAL_PHASE_16_REPORT.md` + `PHASE_17_INPUTS.md` written

## Explicit carry blockers (document in Phase 17 scope)

- [ ] Payment provider (NOT_CONFIGURED — initiation boundary only today)
- [ ] E-sign provider (NOT_CONFIGURED — boundary only today)
- [ ] Full onboarding / training / migration / MRA EIS execution (handoffs only)
- [ ] Owner/team/territory scope filtering beyond stub
- [ ] Telephony / Call recording (NOT_AVAILABLE)
- [ ] Google / Outlook calendar sync (NOT_CONNECTED)
- [ ] Email / WhatsApp Lead ingest
- [ ] Demo recording media + real cloud Demo infra (NOT_AVAILABLE)
- [ ] Windows Prisma EPERM (SQL fallback available)
- [ ] Rich conversion UI hubs beyond thin stubs
- [ ] AI provisioning / auto-merge / fabricate PAID (forbidden in foundations)

## Do not start Phase 17 work that assumes

- Payment already PAID from conversion initiation alone
- Onboarding/training/migration/MRA already completed from handoff emission
- Acceptance evidence deleted by conversion compensation
- Silent multi-currency weighted KPI totals are safe without currency gate
- Fabricated conversion volume KPIs when reliability gate fails
- E-sign signatures already exist from commercial acceptance
