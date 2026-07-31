# Phase 19 Readiness Checklist — from Phase 18

**Date:** 2026-07-31  
**Exit state:** `READY_FOR_PHASE_19_WITH_BLOCKERS`

## Must be true before Phase 19 starts

- [x] Canonical Request/Program domain under `lib/admin/customerSuccess/training/**`
- [x] Phase 16 TRAINING handoffs consumed idempotently (handoff ≠ execute)
- [x] Curriculum versions pinned; ACTIVE immutable once applied
- [x] Participants verified; Cross-Tenant isolation + portfolio fail-closed
- [x] Sessions/attendance/materials/environment honesty boundaries
- [x] Assessments/attempts/grading/completion/certificates with checksum idempotency
- [x] Phase 17 feed does not fabricate onboarding COMPLETED
- [x] Reliability gate never invents zeroes
- [x] DQ / recon / lineage services present
- [x] Phase 8 `CsTrainingRecord` link or UNKNOWN (never invent COMPLETED)
- [x] EN + Chichewa (`ny`) hub keys for training surfaces
- [x] Wave 1–4 Vitest green
- [x] Optional gaps explicit in `PHASE_19_INPUTS.md`

## Phase 19 entry conditions

1. Consume Training outcomes without inventing delivery/completion from foundations emptiness.
2. Preserve invent-zeroes / certificate / virtual-provider typed-unavailable invariants.
3. Treat virtual provider / recording / rich banks / portal / payment/e-sign as blockers until configured.

## Blockers carried (do not clear silently)

| Blocker | Code / note |
|---------|-------------|
| Virtual provider | `VIRTUAL_PROVIDER_NOT_CONFIGURED` |
| Session recording | not delivered |
| Rich LMS / question banks | optional gap |
| Customer training portal | typed unavailable if referenced |
| Providers (payment/e-sign) | Phase 16 carry `NOT_CONFIGURED` |
