### Task 4: Wave 4 — UI hubs, metrics/reliability, DQ/recon, Phase 8 migrate, Phase 19 pack

**Files:**
- Create/extend: Overview, My Work, Team, Calendar/Today/Upcoming, At-Risk, Completion workspace, Context Bar, Request/Program lists/details
- Create: `metrics.js`, `reliabilityGate.js`, `dataQuality.js`, `reconciliation.js`, `lineage.js`, `reports.js`, `exports.js`, `search.js`, `cache.js`, `notifications.js`
- Create: `scripts/sql/cs-training-phase18-wave4.sql` as needed
- Modify: `foundations.js` — Project/Program projection when linked; broken link → UNKNOWN not legacy COMPLETED
- Docs: full phase-18 pack including `PHASE_19_INPUTS.md`, `PHASE_19_READINESS_CHECKLIST.md`, `FINAL_PHASE_18_REPORT.md`, update `FINAL_READINESS_DECISION.md` → **`READY_FOR_PHASE_19_WITH_BLOCKERS`**
- i18n: en + ny training hub keys
- Test: `test/systemAdmin.cs.trainingWave4.test.js`

**Interfaces:**
- Produces:
  - Overview cards via reliability gate — fail → `UNAVAILABLE` / `value: null`
  - My Work scoped counts; list authz + portfolio fail-closed (mirror Phase 17 listScope pattern)
  - Report subset + CSV/XLSX with PII projection; answers/tokens excluded
  - Search for TRQ/TRN/cert numbers — no answers/tokens/restricted materials
  - Phase 8 migrate link; exit readiness documented

- [ ] **Step 1: Write failing Vitest** — gate fail not zero; portfolio list deny; search fail-closed without scope; export strips answers; foundations broken link ≠ COMPLETED; certificate still idempotent; EN key smoke
- [ ] **Step 2: Run Vitest** — expect FAIL
- [ ] **Step 3: Implement** UI + metrics + docs + migrate
- [ ] **Step 4: Re-run Wave 1–4 regression** — PASS; set exit state
- [ ] SDD final review

---
