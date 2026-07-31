# Phase 22 Scope — Customer Training

**Date:** 2026-07-31  
**Decision:** Harden existing Training domain (Approach 1); docs re-home to `phase-22/`; tree-18 remains code/doc alias.

## In scope (Waves 1–4)

1. Consume Phase 21 `emitPhase22TrainingHandoff` with checksum validate / accept / reject / correct / supersede (idempotent).
2. Retarget mislabelled source codes (`PHASE_16_*` / `PHASE_17_*` → PRD-correct aliases; primary `PHASE_21_TRAINING_HANDOFF`).
3. Harden Request (`TRQ-`) / Program (`TRN-`) spine, status machines, curriculum pin, numbering.
4. Curriculum / modules / materials / trainers / cohorts / participants / enrolment / **invitation honesty**.
5. Sessions (`TRS-` retained; SES- alias only if dual codes required), attendance evidence, exercises, assessments, results, completion, certificates.
6. CS + Product Analytics outcome handoffs (source-labelled; no auto Healthy / no fabricated Product Events).
7. Reliability-gated metrics/DQ/recon/reports/exports; Phase 23 input pack; exit `READY_FOR_PHASE_23_WITH_BLOCKERS`.

## Explicitly out of scope

| Item | Class |
|------|-------|
| Demo Management (`lib/admin/crm/demos/**`) | WRONG_DOMAIN — preserve PRD 18 Demo |
| Onboarding Project create / go-live / completion | WRONG_DOMAIN — PRD 21 |
| Adoption Plans (`lib/admin/customerSuccess/adoption/**`) | FUTURE_PHASE_SCOPE |
| Second Training domain / parallel `CustomerTraining*` | FORBIDDEN |
| Delete tree-18 / phase-17 / phase-19 folders | FORBIDDEN |
| Public open LMS / rich SCORM authoring / biometric attendance | FUTURE / CARRY |
| AI-generated attendance/results/certs | FORBIDDEN |
| Tenant GL / MRA fiscal / billing SoT from Training | FORBIDDEN |

## Boundary contracts

| Boundary | Path | Rule |
|----------|------|------|
| Phase 21 handoff emit | `lib/admin/customerSuccess/onboarding/training.js` | Emit only; never Programs/Sessions/certs |
| Phase 16 TRAINING handoff | `lib/admin/crm/conversions/trainingHandoff.js` | Secondary seed; `trainingCompleted: false` |
| Training domain | `lib/admin/customerSuccess/training/**` | Sole delivery SoT |
| Onboarding coordination feed | `training/onboardingFeed.js` → `onboarding/training.js` | Typed outcome; no auto onboarding COMPLETED |
| Phase 8 foundations | `CsTrainingRecord` (`prisma/schema.prisma` ~11287) | REUSE_WITH_RECONCILIATION — UNKNOWN if unlinked |

## Scope verdict

**IN SCOPE for CONDITIONAL GO** — durable spine exists under tree-18; Phase 22 work is handoff primary consume + honesty gaps + PRD label correction, not greenfield and not Demo→Training.

