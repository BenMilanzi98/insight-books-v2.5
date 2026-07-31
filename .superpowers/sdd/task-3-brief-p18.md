### Task 3: Wave 3 — Exercises, assessments, completion, certificates, Phase 17 feed

**Files:**
- Create: `exercises.js`, `assessments.js`, `attempts.js`, `grading.js`, `completion.js`, `certificates.js`, `onboardingFeed.js`, `health.js`, `progress.js`
- Create: `scripts/sql/cs-training-phase18-wave3.sql` + Prisma for Assessment/Version/Attempt/Result/Regrade/Completion/Certificate
- Modify: Phase 17 `training.js` / readiness only via `publishTrainingOutcomeToOnboarding` (typed); do not allow onboarding set-training-status to forge COMPLETED without domain source (already gated — ensure feed writes correct source)
- Test: `test/systemAdmin.cs.trainingWave3.test.js`

**Interfaces:**
- Produces:
  - Exercise submit/review/pass/retry/waiver
  - `startAssessmentAttempt` / `submitAssessmentAttempt` — server timer + attempt limit; answers not leaked in list payloads
  - Objective grade + manual grade; finalise immutable; retake; regrade preserves original
  - `evaluateParticipantCompletion` / Program completion against policy version
  - `issueTrainingCertificate({ participantCompletionId, templateVersionId, idempotencyKey })` — checksum; exact retry same cert; revoke → verification REVOKED
  - `publishTrainingOutcomeToOnboarding` — sets Phase 17 coordination `trainingDomainSource`/`trainingDomainStatus`; does not mark onboarding Project COMPLETED
  - Onboarding manual COMPLETED without domain source still fails

- [ ] **Step 1: Write failing Vitest** — attempt beyond limit fails; client-only timer not authoritative; final result immutable without regrade; completion blocked without attendance; cert without completion fails; cert retry same checksum; revoke verifies REVOKED; onboarding feed updates readiness dim; onboarding cannot fabricate COMPLETED; Cross-Tenant program access denied
- [ ] **Step 2: Run Vitest** — expect FAIL
- [ ] **Step 3: Implement** + thin UI tabs
- [ ] **Step 4: Re-run Wave 1+2+3** — PASS
- [ ] SDD review gate before Wave 4

---
