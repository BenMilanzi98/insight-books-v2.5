### Task 4: Wave 4 — UI queues, metrics/reliability, DQ/recon, Phase 21 pack, exit

**Files:**
- Extend conversion Overview/My Work/queues/detail as needed; optional thin `/crm/closed-won/*` aliases
- Harden: metrics, reliabilityGate, dataQuality, reconciliation, exports, search (fail-closed; never false zero)
- Docs: `PHASE_21_INPUTS.md`, `PHASE_21_READINESS_CHECKLIST.md`, `FINAL_PHASE_20_REPORT.md`, `FINAL_READINESS_DECISION.md` → **`READY_FOR_PHASE_21_WITH_BLOCKERS`**
- i18n: en + ny conversion hub keys as needed
- Test: `test/systemAdmin.crm.conversionPhase20Wave4.test.js`

**Interfaces:**
- Produces:
  - Gate fail → UNAVAILABLE / value null
  - Search/export/DQ/recon portfolio/team/territory fail-closed
  - Closed-Won / accepted value not labelled as collected/recognised Revenue
  - Phase 21 pack documents handoff contract + carry blockers + mislabel map pointer
  - Exit decision recorded

- [ ] **Step 1: Write failing Vitest** — gate null; scope fail-closed; exit pack WITH_BLOCKERS; no fabricated zeroes
- [ ] **Step 2: Run** — expect FAIL
- [ ] **Step 3: Implement** UI/metrics/docs
- [ ] **Step 4: Re-run Waves 1–4** — PASS
- [ ] SDD final whole-branch review before exit ratification

---
