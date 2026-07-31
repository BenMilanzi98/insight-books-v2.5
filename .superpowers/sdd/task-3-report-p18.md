# Task 3 Report ù Phase 18 Wave 3 (Exercises / assessments / completion / certificates)

**Date:** 2026-07-31  
**Status:** COMPLETE (GREEN)  
**Commit:** none (per brief)

---

## Summary

Implemented Phase 18 Wave 3 under `lib/admin/customerSuccess/training/**`: exercises (submit/review/pass/retry/waiver), assessments with server timers + attempt limits, grading/finalise/regrade (original preserved), participant completion against policy version, checksummed certificates (issue/revoke/verify), typed `publishTrainingOutcomeToOnboarding` (does not mark onboarding Project COMPLETED), plus health/progress. SQL + Prisma models, thin Program tabs, Vitest Wave 1+2+3 green.

---

## RED

```text
npx vitest run test/systemAdmin.cs.trainingWave3.test.js

 FAIL  test/systemAdmin.cs.trainingWave3.test.js
 TypeError: createTrainingAssessment is not a function
 ù
 TypeError: submitTrainingExercise is not a function
 TypeError: issueTrainingCertificate is not a function
 TypeError: loadTrainingProgramForActor is not a function
 Test Files  1 failed (1)
      Tests  11 failed (11)
```

Failure mode: missing Wave 3 domain exports (expected before implementation).

---

## GREEN

```text
npx vitest run test/systemAdmin.cs.trainingWave3.test.js test/systemAdmin.cs.trainingWave2.test.js test/systemAdmin.cs.trainingWave1.test.js

 Test Files  3 passed (3)
      Tests  33 passed (33)
 Duration  ~2.54s
```

| Case | Result |
|------|--------|
| Attempt beyond limit fails | PASS |
| Client-only timer not authoritative (server window wins) | PASS |
| Final result immutable without regrade; regrade preserves original | PASS |
| Completion blocked without attendance | PASS |
| Cert without completion fails; retry same checksum; revoke ? REVOKED | PASS |
| Onboarding feed updates readiness dim; Project not COMPLETED | PASS |
| Onboarding cannot fabricate Training COMPLETED | PASS |
| Cross-Tenant program access denied | PASS |
| List attempts do not leak answers | PASS |
| Exercise waiver + health/progress versioned | PASS |
| Retake after failed finalised within limit | PASS |
| Wave 1 regression (10) + Wave 2 (11) | PASS |

---

## Deliverables

| Area | Path |
|------|------|
| Domain | `lib/admin/customerSuccess/training/{exercises,assessments,attempts,grading,completion,certificates,onboardingFeed,health,progress,programAccess}.js` (+ catalogue/numbering/model/index) |
| SQL | `scripts/sql/cs-training-phase18-wave3.sql` |
| Prisma | `CustomerTraining{Exercise,Assessment,AssessmentVersion,AssessmentAttempt,AssessmentResult,AssessmentRegrade,CompletionPolicy,ParticipantCompletion,ProgramCompletion,Certificate}` |
| Prefix | `CRM_NUMBER_PREFIX.CERT` ? `IB-TRN-CERT` |
| UI | `app/insightbooks/customer-success/training/programs/[id]/{exercises,assessments,completion,certificates}/page.js` (+ program hub links) |
| Test | `test/systemAdmin.cs.trainingWave3.test.js` |

### Interfaces shipped

- `submitTrainingExercise` / `reviewTrainingExercise` / `waiveTrainingExercise` / `retryTrainingExercise`
- `createTrainingAssessment` / `startAssessmentAttempt` / `submitAssessmentAttempt` / `listAssessmentAttempts` (no answers)
- `gradeAssessmentAttempt` / `finaliseAssessmentResult` / `retakeAssessment` / `regradeAssessmentAttempt` (original preserved)
- `evaluateParticipantCompletion` / `evaluateProgramCompletion` against `training-completion-policy-v1`
- `issueTrainingCertificate` / `revokeTrainingCertificate` / `verifyTrainingCertificate` ù checksum; exact retry; REVOKED
- `publishTrainingOutcomeToOnboarding` ù `trainingDomainSource=PHASE_18_TRAINING`; does **not** set onboarding Project COMPLETED
- `loadTrainingProgramForActor` ù Cross-Tenant denied
- `calculateTrainingHealth` / `calculateTrainingProgress` ù versioned; progress ? completion

---

## Concerns / follow-ups

1. **Prisma generate** not run here (Windows EPERM risk) ù SQL script is the EPERM fallback; generate when safe.
2. **SDD review gate** before Wave 4.
3. Thin UI tabs only ù full hubs/metrics/DQ/recon remain Wave 4.
4. Program completion evaluator is aggregate/status-only (no persisted ProgramCompletion row on every feed); Wave 4 may harden program-level persistence if needed.

---

## Exit for Task 3

Wave 3 acceptance criteria from brief met under Vitest. Ready for SDD review before Wave 4.

## Fix wave

**Date:** 2026-07-31  
**Trigger:** Task 3 review Important findings (#1ñ4)  
**No git commit**

### Fixes

| Finding | Change |
|---------|--------|
| Important: completion accepts non-finalised PASSED | `evaluateParticipantCompletion` assessment gate requires `immutable` or `status === FINALISED` (raw PASSED insufficient) |
| Important: attendance not program-scoped | Attendance PRESENT counted only via session ? `programId` match for the enrolmentís program |
| Important: cert/attempt idempotent replay skips payload match | `issueTrainingCertificate` / `startAssessmentAttempt` ? `idempotency_conflict` when `participantCompletionId` / `templateVersionId` or `assessmentVersionId` / `participantId` (/ program / enrolment) disagree |
| Important: grade bypasses submit/timer | `gradeAssessmentAttempt` rejects non-submittable statuses (`IN_PROGRESS` etc.); allows `SUBMITTED` / `GRADED` / `AUTO_GRADING` / `MANUAL_REVIEW` |

### Tests added / extended

- Completion rejects non-finalised PASSED assessment results
- Completion attendance scoped to program sessions (cross-program PRESENT ignored)
- Cert + attempt idempotent replay conflict on identity mismatch
- `gradeAssessmentAttempt` rejects `IN_PROGRESS`

### Command output

```text
$ npx vitest run test/systemAdmin.cs.trainingWave1.test.js test/systemAdmin.cs.trainingWave2.test.js test/systemAdmin.cs.trainingWave3.test.js

 RUN  v4.1.2 C:/laragon/www/insight-books-v2.5

 Test Files  3 passed (3)
      Tests  37 passed (37)
 Duration  ~2.31s
```
