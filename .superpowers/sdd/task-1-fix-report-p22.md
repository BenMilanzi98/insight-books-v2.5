# Task 1 Fix Report — Phase 22 Wave 1 (Important review items)

**Date:** 2026-07-31  
**Status:** **FIXED**  
**Review:** `.superpowers/sdd/task-1-review-p22.md`  
**No git commit.**

## Important items closed

| # | Issue | Fix |
|---|-------|-----|
| 1 | `acceptTrainingHandoff` omitted Spec §6 duplicate active Program purpose check | Before Request create, call exported `findActiveProgramForPurpose`; refuse with `duplicate_active_program_purpose` (no TRQ / no `ACCEPTED_BY_TRAINING`) |
| 2 | Accept + Program create omitted portfolio fail-closed | Added `assertTrainingTenantInPortfolioScope` in `programAccess.js`; gate both `acceptTrainingHandoff` and `createCustomerTrainingProgram` |

## Tests

- Added / updated in `test/systemAdmin.cs.trainingPhase22Wave1.test.js`:
  - accept refuses duplicate active purpose (no new Request)
  - portfolio fail-closed on accept + Program create for scoped CS
- Re-run: Wave1 (12) + tree `trainingWave1` (10) → **22/22 PASS**

## Files touched

- `lib/admin/customerSuccess/training/handoffConsume.js`
- `lib/admin/customerSuccess/training/programs.js`
- `lib/admin/customerSuccess/training/programAccess.js`
- `lib/admin/customerSuccess/training/index.js`
- `test/systemAdmin.cs.trainingPhase22Wave1.test.js`
- `.superpowers/sdd/task-1-report-p22.md` (append)

## Residual (Minor — not blocking)

Review Minors (acceptInputHash notes compare; handoffId Program create alias; Phase 18 header polish) left for later polish / Task 2+ as non-blocking.
