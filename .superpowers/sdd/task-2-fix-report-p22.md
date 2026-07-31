# Task 2 Fix Report — Phase 22 Wave 2 (Important review items)

**Date:** 2026-07-31  
**Status:** **FIXED**  
**Review:** `.superpowers/sdd/task-2-review-p22.md`  
**No git commit.**

## Important items closed

| # | Issue | Fix |
|---|-------|-----|
| 1 | `UNKNOWN` conflict allowed trainer assign without exception | `needsException` includes `UNKNOWN`; refuse with `trainer_conflict_UNKNOWN_requires_approved_exception` unless `approvedException` / `allowBlockedConflict` |
| 2 | Exception flags bypassed capacity with `NO_CONFLICT` | Capacity skip only when `governedConflictException` (`needsException && hasApprovedException`); bare exception flags no longer defeat capacity |
| 3 | DRAFT / role-module bind dead under `immutable @default(true)` | Schema default `immutable: false` for CurriculumVersion + ModuleVersion; serializer uses `immutable === true`; DRAFT authorable; freeze on ACTIVE transition; ACTIVE/applied still immutable |

## Tests

Added in `test/systemAdmin.cs.trainingPhase22Wave2.test.js`:

- DRAFT curriculum authorable + role-module bind → freezes on ACTIVE
- UNKNOWN conflict refuses assign without approved exception
- Capacity not bypassed by exception flags when there is no conflict

**Re-run:** Phase22 Wave1 + Phase22 Wave2 + tree Wave2 → **38/38 PASS**

## Files touched

- `lib/admin/customerSuccess/training/trainers.js`
- `lib/admin/customerSuccess/training/curricula.js`
- `lib/admin/customerSuccess/training/model.js`
- `prisma/schema.prisma`
- `test/systemAdmin.cs.trainingPhase22Wave2.test.js`
- `.superpowers/sdd/task-2-report-p22.md` (append)

## Residual (Minor — not blocking)

Review Minors (enrolment idempotent input conflict; prereq evidence lookup; reauth token verify; answer-key field set) left for Wave 3+ polish.
