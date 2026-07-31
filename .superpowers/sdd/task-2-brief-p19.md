### Task 2: Wave 2 — Milestones, value outcomes, Phase 9 evidence, Plan completion evaluation

**Files:**
- Create: `milestones.js`, `valueOutcomes.js`, `evidence.js`, `completion.js`, `health.js`
- Create: `scripts/sql/cs-adoption-phase19-wave2.sql` + Prisma Milestone/ValueOutcome/EvidenceSnapshot models
- Wire: Phase 9 `firstValue` / `adoption` / `signals` read-only; Phase 18 cert/program read for TRAINING_CERT mode
- Modify: `status.js` — Plan → `COMPLETED` requires `evaluateAdoptionPlanCompletion` + manage + planAccess
- Test: `test/systemAdmin.cs.adoptionWave2.test.js`

**Interfaces:**
- Produces:
  - Materialise milestones from pinned template (idempotent once per plan/templateVersion)
  - `evaluateAdoptionMilestone({ planId, milestoneId, actorContext })` — PRODUCT_ANALYTICS / TRAINING_CERT / CS_ATTESTATION / MIXED
  - Gate fail / missing analytics → status UNKNOWN + evidence UNAVAILABLE (never MET)
  - `attestAdoptionMilestone` / `waiveAdoptionMilestone` (SoD on critical waiver)
  - `recordAdoptionValueOutcome` — snapshot + lineage; null/UNAVAILABLE not false zero
  - `evaluateAdoptionPlanCompletion` — all critical milestones MET|WAIVED + value review sign-off + no blocking Critical DQ
  - `transitionAdoptionPlanStatus` to COMPLETED blocked unless evaluation passes (or audited executive waiver)

- [ ] **Step 1: Write failing Vitest** — analytics gate fail ≠ MET; Training WITH_GAPS cert path ≠ MET for TRAINING_CERT requiring Program COMPLETED; any-one-milestone ≠ Plan COMPLETED; ungated COMPLETED transition rejected; attestation requires manage+access; value missing → UNAVAILABLE null
- [ ] **Step 2: Run Vitest** — expect FAIL
- [ ] **Step 3: Implement** lib + SQL + thin UI tabs
- [ ] **Step 4: Re-run Wave 1+2** — PASS
- [ ] SDD review gate before Wave 3

---
