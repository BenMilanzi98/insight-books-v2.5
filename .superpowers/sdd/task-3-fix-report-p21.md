# Task 3 Re-fix Report — Phase 21 Wave 3

**Date:** 2026-07-31  
**Against:** `.superpowers/sdd/task-3-review-p21.md`  
**Git commit:** none

## Critical / Important fixed

| # | Severity | Status |
|---|----------|--------|
| SUCCESSFUL requires IN_PROGRESS (+ defects/readiness); schedule ≠ SUCCESSFUL | Critical | **FIXED** |
| SUCCESSFUL refuses null goLive (no STABILISATION without evidence) | Important #5 | **FIXED** |
| Executable GO decision required before schedule/execute | Important #1 | **FIXED** |
| Stabilisation exit requires prior checks/criteria (no invent EXITED) | Important #2 | **FIXED** |
| `dimensionOverrides` harness-only (`allowDimensionOverrides`) | Important #3 | **FIXED** |
| Certificate go-live waiver needs control flag | Important #4 (partial) | **FIXED** (no full §9 checklist expansion) |

Minors: handover `idempotencyKey` required; latest decision ordering; completion header Phase 21.

## Tests

- `systemAdmin.cs.onboardingPhase21Wave3.test.js` — **11/11 PASS** (incl. schedule≠SUCCESSFUL, null evidence, decision required, invent EXITED)
- Phase21 Waves 1–2 — **19/19 PASS**
- `systemAdmin.cs.onboardingWave3.test.js` — **18/18 PASS**
- **Combined 48/48 PASS**

## Paths

- Report: `.superpowers/sdd/task-3-report-p21.md` (fix notes appended)
- Review: `.superpowers/sdd/task-3-review-p21.md`
