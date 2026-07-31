### Task 3: Wave 3 — Readiness coordination, go-live, stabilisation, handover, completion certificate

**Files:**
- Create: `readiness/tenant.js`, `readiness/businessBranch.js`, `readiness/users.js`, `readiness/configuration.js`, `readiness/accounting.js`, `readiness/evaluate.js`, `migration.js`, `mraEis.js`, `training.js`, `testing.js`, `defects.js`, `goLive.js`, `stabilisation.js`, `handover.js`, `completion.js`, `health.js`, `progress.js`
- Create: `scripts/sql/cs-onboarding-phase17-wave3.sql` + Prisma for ReadinessEvaluation, GoLive, GoLiveApproval, Stabilisation, Handover, Completion, CompletionCertificate, TestPlan/Case/Result, Defect, Risk, Issue, Document metadata (no credential storage)
- Test: `test/systemAdmin.cs.onboardingWave3.test.js`

**Interfaces:**
- Produces:
  - `evaluateOnboardingReadiness(projectId)` — dimensions; `UNKNOWN` ≠ READY
  - Migration state machine; file inventory metadata + security flags; recon gate blocks complete
  - MRA readiness states; credential status boundary only
  - Training coordination consuming Phase 16 TRAINING handoff; cannot set COMPLETED without Training-domain source (Phase 18 stub returns UNKNOWN/IN_PROGRESS)
  - `approveGoLive` / `executeGoLive` / `recordGoLiveOutcome` — Critical defect blocks; success → `STABILISATION`
  - Stabilisation exit criteria + approval
  - Handover create/accept
  - `evaluateOnboardingCompletion` / `issueCompletionCertificate` — checksum; exact retry same certificate; blocked without sign-offs/recon/handover
  - `calculateOnboardingProgress` / `calculateOnboardingHealth` — server-side, versioned rules
  - Accounting boundary assert helper: no journal/OB/stock create from onboarding modules

- [ ] **Step 1: Write failing Vitest** — UNKNOWN readiness blocks go-live; Critical defect blocks approval; successful go-live → STABILISATION not COMPLETED; migration COMPLETED rejected without recon; training COMPLETED rejected without Training source; completion without Customer sign-off fails; certificate checksum stable on retry; accounting boundary (no journal); Cross-Tenant project access denied
- [ ] **Step 2: Run Vitest** — expect FAIL
- [ ] **Step 3: Implement** readiness + go-live + completion path + thin UI tabs
- [ ] **Step 4: Re-run Vitest** — PASS
- [ ] SDD review gate before Wave 4

---
