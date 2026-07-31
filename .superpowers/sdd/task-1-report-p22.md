# Task 1 Report — Phase 22 Wave 1 (Handoff validate/accept + Request/Program spine)

**Date:** 2026-07-31  
**Status:** **PASS**  
**Scope:** Harden `lib/admin/customerSuccess/training/**` Wave 1 surfaces. No Sessions/attendance/certs. No second Training domain. No Demo/onboarding reimplementation. No git commit.

## Verdict

Phase 21 `emitPhase22TrainingHandoff` is now consumable in Training via checksum validate + idempotent `acceptTrainingHandoff` → TRQ (`PHASE_21_TRAINING_HANDOFF`). Catalogue retargeted (`phase: 22`, `treePhaseAlias: 18`; legacy PHASE_16/17 source aliases mapped). Program create after Request accept pins curriculum, allocates `TRN-`, blocks duplicate active purpose. Invalid status transitions throw. Legacy CRM `consumeTrainingHandoff` preserved for regression.

## Deliverables

| Item | Result |
|------|--------|
| `validateTrainingHandoff` / `acceptTrainingHandoff` | **DONE** — checksum; UNKNOWN≠VALID; exact retry; supersession history preserved |
| Source retarget | **DONE** — `PHASE_21_TRAINING_HANDOFF` primary; `resolveTrainingRequestSource` maps PHASE_16/17 |
| Domain contract | **DONE** — `phase: 22`, `prdPhase: 22`, `treePhaseAlias: 18`, `wave: 1` |
| Request / Program spine | **DONE** — create/idempotent; Program after accept; TRN-; curriculum pin; duplicate purpose blocked |
| Vitest Wave 1 | **PASS** — `test/systemAdmin.cs.trainingPhase22Wave1.test.js` (12 after review fix) |
| Regression | **PASS** — `test/systemAdmin.cs.trainingWave1.test.js` (10); combined **22/22** |
| Sessions / attendance / certs | **NOT created** (out of Wave 1 scope) |

## Gaps closed (Wave 1)

| Gap | Disposition |
|-----|-------------|
| G22-01 | CLOSED — Phase 21 handoff validate/accept with checksum |
| G22-02 | CLOSED — accept idempotent; conflicting key fails; supersession preserves history |
| G22-03 | CLOSED — `PHASE_21_TRAINING_HANDOFF` + alias map |
| G22-06 | CLOSED — Program create from accepted Request (not from emit alone) |

## Key files

- `lib/admin/customerSuccess/training/catalogue.js`
- `lib/admin/customerSuccess/training/handoffConsume.js`
- `lib/admin/customerSuccess/training/programs.js`
- `lib/admin/customerSuccess/training/programAccess.js`
- `lib/admin/customerSuccess/training/index.js`
- `test/systemAdmin.cs.trainingPhase22Wave1.test.js`

## Review fix notes (Important → closed)

Addressed `task-1-review-p22.md` Important items before Task 2:

1. **Accept duplicate active Program purpose (Spec §6)** — `acceptTrainingHandoff` now calls `findActiveProgramForPurpose` (same helper as Program create) before TRQ create / `ACCEPTED_BY_TRAINING`. Returns `duplicate_active_program_purpose` without creating a Request. Wave1 assertion updated accordingly.
2. **Portfolio/scope fail-closed** — added `assertTrainingTenantInPortfolioScope` (mirrors onboarding); gated on `acceptTrainingHandoff` and `createCustomerTrainingProgram`. Empty / out-of-portfolio `portfolioTenantIds` deny write. Wave1 scoped-deny test added.

**Re-run:** `npx vitest run test/systemAdmin.cs.trainingPhase22Wave1.test.js test/systemAdmin.cs.trainingWave1.test.js` → **22/22 PASS**.  
**Fix report:** `.superpowers/sdd/task-1-fix-report-p22.md`

## Stop

SDD review gate before Wave 2. Do not fabricate Programs from handoff emit alone; do not Demo→Training; do not invent attendance/certs in Wave 1.
