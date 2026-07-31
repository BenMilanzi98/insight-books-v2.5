# Phase 18 Readiness Checklist — from Phase 17

**Date:** 2026-07-31  
**Exit state:** `READY_FOR_PHASE_18_WITH_BLOCKERS`

## Must be true before Phase 18 starts

- [x] Canonical Request/Project domain under `lib/admin/customerSuccess/onboarding/**`
- [x] Phase 16 ONBOARDING handoffs consumed idempotently (handoff ≠ execute)
- [x] Templates versioned; materialisation once; ACTIVE immutable
- [x] Customer evidence attestation governed; portal typed unavailable
- [x] Scope mismatch → Change Request (no silent entitlement escalation)
- [x] Tenant/Business/Branch isolation + Cross-Tenant denial
- [x] Accounting posting boundary holds; System CoA remains removed
- [x] Go-live → stabilisation → handover → evidence-based completion + checksum
- [x] Reliability gate never invents zeroes
- [x] DQ / recon / lineage services present
- [x] Phase 8 `CsOnboardingRecord` link or UNKNOWN (never invent COMPLETED)
- [x] EN + Chichewa (`ny`) hub keys for onboarding surfaces
- [x] Wave 1–4 Vitest green
- [x] Optional gaps explicit in `PHASE_18_INPUTS.md`

## Phase 18 entry conditions

1. Consume training coordination without fabricating Training COMPLETED from onboarding.
2. Preserve invent-zeroes / certificate / accounting / portal typed-unavailable invariants.
3. Treat portal / migration engine / MRA fiscal / payment/e-sign as blockers until configured.

## Blockers carried (do not clear silently)

| Blocker | Code / note |
|---------|-------------|
| Customer portal | `CUSTOMER_PORTAL_NOT_CONFIGURED` |
| Training engine | Phase 18 ownership |
| Migration engine | `NOT_AVAILABLE` |
| MRA fiscal | boundary only |
| Providers (payment/e-sign) | Phase 16 carry `NOT_CONFIGURED` |
