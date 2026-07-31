# Task 3 Fix Report — Phase 22 Wave 3 review (Critical + Important)

**Date:** 2026-07-31  
**Status:** **FIXED**  
**Review:** `.superpowers/sdd/task-3-review-p22.md`  
**No git commit.**

## Critical

1. **Superseded PRESENT counted for completion** — `completion.js`  
   `evaluateParticipantCompletion` now filters `!supersededById` before PRESENT-like checks (current projection only). Correction PRESENT→NO_SHOW no longer yields false COMPLETED / cert eligibility under attendance-only policy.

## Important

1. **Exercise fiscal isolation opt-in** — `exercises.js`  
   `assertTrainingEnvironmentIsolation` always runs; default `fiscalPlane: SANDBOX_LABELLED` when omitted. Explicit Production GL/journals/stock/MRA still refused.

2. **Schedule idempotent replay lied about delivery** — `sessions.js`  
   `idempotentSessionReplay` returns `sessionDelivered: existing.sessionDelivered === true` (honest state after `markTrainingSessionDelivered`).

## Regression tests

- Superseded PRESENT → completion blocked (`ATTENDANCE_REQUIRED`); tip PRESENT_LATE still completes under attendance-only policy  
- Exercise omit `fiscalPlane` still asserts (default sandbox ok); Production planes still blocked  
- Schedule replay after deliver → top-level `sessionDelivered: true`

## Vitest

`npx vitest run test/systemAdmin.cs.trainingPhase22Wave1.test.js test/systemAdmin.cs.trainingPhase22Wave2.test.js test/systemAdmin.cs.trainingPhase22Wave3.test.js test/systemAdmin.cs.trainingWave3.test.js` → **53/53 PASS**
