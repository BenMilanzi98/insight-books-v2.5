### Task 4: Wave 4 — UI hubs, metrics/reliability, DQ/recon, Phase 8 reconcile, Phase 20 pack

**Files:**
- Create/extend: Overview, My Work, Team, Portfolio, Attention/Dormancy, Context Bar, Request/Plan lists/details, reports
- Create: `metrics.js`, `reliabilityGate.js`, `dataQuality.js`, `reconciliation.js`, `lineage.js`, `reports.js`, `exports.js`, `search.js`, `myWork.js`, `cache.js`
- Create: `scripts/sql/cs-adoption-phase19-wave4.sql` as needed
- Modify: Phase 8 foundations/plans projection when `adoptionPlanId` linked; broken link → UNKNOWN not legacy COMPLETED
- Docs: full phase-19 pack including `PHASE_20_INPUTS.md`, `PHASE_20_READINESS_CHECKLIST.md`, `FINAL_PHASE_19_REPORT.md`, update `FINAL_READINESS_DECISION.md` → **`READY_FOR_PHASE_20_WITH_BLOCKERS`**
- i18n: en + ny `customerSuccess.adoptionHub.*` keys
- Test: `test/systemAdmin.cs.adoptionWave4.test.js`

**Interfaces:**
- Produces:
  - Overview/metric cards via reliability gate (fail → UNAVAILABLE / value null)
  - Search ADR/ADP (+ handoff ids) portfolio-scoped; empty scope → `[]`
  - Export/DQ/recon portfolio-scoped; never invent `totalRequests: 0` / `lineageIntact: true` as success when incomplete
  - My Work owner + portfolio scoped
  - Phase 20 pack honesty (carry blockers listed)
  - Exit decision `READY_FOR_PHASE_20_WITH_BLOCKERS`

- [ ] **Step 1: Write failing Vitest** — gate fail null; search/export/DQ fail-closed; false-zero request count rejected; foundations broken ≠ COMPLETED; Phase 20 pack present with WITH_BLOCKERS
- [ ] **Step 2: Run Vitest** — expect FAIL
- [ ] **Step 3: Implement** UI + metrics + docs + i18n
- [ ] **Step 4: Re-run Waves 1–4** — PASS
- [ ] SDD final whole-branch review before exit ratification

---
