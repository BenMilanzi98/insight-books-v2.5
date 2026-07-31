# Phase 22 Readiness Checklist — from Phase 21

**Exit gate:** `READY_FOR_PHASE_22_WITH_BLOCKERS`  
**Date:** 2026-07-31

## Must be true before Phase 22 starts consuming Training handoffs

- [x] Compatibility map documents PRD ↔ tree numbering; Training/Adoption quarantined, not deleted
- [x] One canonical Onboarding domain (`CustomerOnboarding*` / `lib/admin/customerSuccess/onboarding/**`)
- [x] Handoff checksum/accept idempotent; Project create idempotent
- [x] Request ≠ result readiness honesty; UNKNOWN ≠ READY
- [x] Go-live / completion evidence-based; go-live ≠ completion
- [x] Phase 22 Training handoff complete (checksum/idempotent; no Training delivery)
- [x] Reliability gate never false zero; portfolio/tenant scopes fail-closed
- [x] Search/export/DQ/recon never invent zeroes / `lineageIntact: true`
- [x] Progress ≠ readiness ≠ completion; completion ≠ adoption
- [x] Domain contract PRD phase 21; EN + NY `customerSuccess.onboardingHub.*` honesty keys
- [x] Vitest Phase 21 Waves 1–4 (+ tree Wave 4) green for hardened gaps
- [x] Phase 22 input pack documents Training handoff + carry blockers + mislabel map pointer

## Explicit blockers carried into Phase 22

- [ ] Training Programs / Sessions / attendance / certificates delivery (PRD 22 / tree-18)
- [ ] Customer evidence portal configured
- [ ] Payment / e-sign providers configured
- [ ] Full migration engine / MRA fiscal submission
- [ ] Rich scheduled-report polish / full lineage instrumentation
- [ ] Prisma EPERM Windows generate/push resolved (SQL fallback OK)

## Stop conditions

- Do not invent KPI zeroes on reliability gate failure
- Do not invent `lineageIntact: true` without instrumentation
- Do not create Training Programs/Sessions from Phase 21 handoff emission alone
- Do not treat progress / readiness as completion or completion as adoption
- Do not claim tree-18 Training is Adoption Phase 20
- Do not delete mislabelled CS folders
- Do not start Phase 22 Training delivery until this checklist + `PHASE_22_INPUTS.md` are accepted
