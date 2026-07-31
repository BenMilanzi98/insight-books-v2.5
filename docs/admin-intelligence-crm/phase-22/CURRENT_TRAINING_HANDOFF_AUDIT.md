# Current Training Handoff Audit

**Audited:** 2026-07-31  
**Lens:** PRD Phase 22 Customer Training (tree phase-18 code alias)

| Check | Class | Evidence |
|-------|-------|----------|
| Phase 16 TRAINING emit | CORRECT_AND_REUSABLE | `lib/admin/crm/conversions/trainingHandoff.js` — trainingCompleted forced false |
| Phase 16 consume → TRQ | CORRECT_AND_REUSABLE / EXTEND | `training/handoffConsume.js` consumeTrainingHandoff + acknowledge IN_PROGRESS only |
| Phase 21 Phase22 emit | CORRECT_AND_REUSABLE | `onboarding/training.js` emitPhase22TrainingHandoff + computePhase22TrainingHandoffChecksum |
| Phase 21 Phase22 refuse delivery | CORRECT_AND_REUSABLE | refusePhase22TrainingDelivery blocks Program/Session/attendance/cert create |
| Phase 21 Phase22 accept/validate/consume | NOT_FOUND | No acceptTrainingHandoff / consumePhase22TrainingHandoff in training/** |
| Handoff model | CORRECT_AND_REUSABLE | Prisma CustomerOnboardingPhase22TrainingHandoff (has*Model guard in onboarding/model.js) |
| Acceptance ≠ delivery | CORRECT_AND_REUSABLE pattern | Emit meta createsPrograms/Sessions/Attendance/Certificates = false |

**Implication:** Primary Critical gap: Training domain does not yet consume Phase 21 Phase22 handoffs with checksum validation (Wave 1).

