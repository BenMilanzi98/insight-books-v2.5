# Phase 23 Readiness Checklist — from Phase 22

**Exit gate:** `READY_FOR_PHASE_23_WITH_BLOCKERS`  
**Date:** 2026-07-31

## Must be true before Phase 23 starts consuming Training identity/source context

- [x] Compatibility map documents PRD ↔ tree numbering; Demo preserved; Adoption quarantined, not deleted
- [x] One canonical Training domain (`CustomerTraining*` / `lib/admin/customerSuccess/training/**`; tree-18 ≡ PRD 22)
- [x] Phase 21 Training handoff checksum/accept idempotent; Request/Program create idempotent
- [x] Curriculum/trainers/cohorts/enrolment honesty (Wave 2)
- [x] Sessions/attendance/assessments/completion/certificates + CS/PA handoffs (Wave 3)
- [x] Reliability gate never false zero; portfolio/tenant scopes fail-closed
- [x] Search/export/DQ/recon never invent zeroes / `lineageIntact: true`; no answer keys in search/export
- [x] Progress ≠ quality ≠ completion; completion ≠ adoption; Training ≠ marketing attribution
- [x] Domain contract PRD phase 22; EN + NY `customerSuccess.trainingHub.*` honesty keys
- [x] Vitest Phase 22 Waves 1–4 (+ tree Wave 4) green for hardened gaps
- [x] Phase 23 input pack documents identity/source/consent/communication-eligibility + carry blockers + mislabel map pointer

## Explicit blockers carried into Phase 23

- [ ] Marketing Attribution domain / campaign evidence plane (PRD 23)
- [ ] Marketing-consent + communication-eligibility SoT outside Training
- [ ] Customer evidence portal configured
- [ ] Payment / e-sign providers configured
- [ ] Full migration engine / MRA fiscal submission
- [ ] Virtual meeting provider configured
- [ ] Rich scheduled-report polish / full lineage instrumentation
- [ ] Prisma EPERM Windows generate/push resolved (SQL fallback OK)

## Stop conditions

- Do not invent KPI zeroes on reliability gate failure
- Do not invent `lineageIntact: true` without instrumentation
- Do not treat Training attendance/completion as acquisition attribution without campaign evidence
- Do not treat Participants as auto Leads or marketing audiences
- Do not treat progress / quality as completion or completion as adoption
- Do not absorb Demo (PRD 18) into Training or Attribution
- Do not delete mislabelled CS folders
- Do not start Phase 23 Marketing Attribution until this checklist + `PHASE_23_INPUTS.md` are accepted
