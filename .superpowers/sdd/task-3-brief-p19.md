### Task 3: Wave 3 — Champions, dormancy recovery, Phase 8 intervention links, expansion handoffs

**Files:**
- Create: `champions.js`, `dormancy.js`, `interventions.js`, `expansion.js`
- Create: `scripts/sql/cs-adoption-phase19-wave3.sql` + Prisma Champion/DormancyCase/ExpansionHandoff (+ link tables)
- Wire: Phase 8 `interventions.js` / `playbooks.js` create/link only; Phase 9 signals for dormancy queue
- Test: `test/systemAdmin.cs.adoptionWave3.test.js`

**Interfaces:**
- Produces:
  - `upsertAdoptionChampion` — contact-verified; no fabricated engagement score
  - `listDormancyRiskQueue` — Phase 9 VALUE_THEN_INACTIVE / inactive-class; UNAVAILABLE if analytics missing (not empty-as-healthy zero)
  - `openDormancyRecoveryCase` / `linkPhase8Intervention` / `attestDormancyOutcome`
  - `RECOVERED` blocked without usage-return snapshot and/or attested outreach
  - `createExpansionHandoff` / `acknowledgeExpansionHandoff` — statuses stop at HANDED_OFF/ACKNOWLEDGED; no Subscription/entitlement/invoice writes
  - Exact retry same expansion key → same handoff; writes use `loadAdoptionPlanForActor`

- [ ] **Step 1: Write failing Vitest** — dormancy RECOVERED without evidence fails; analytics missing → UNAVAILABLE not healthy zero; intervention link requires Phase 8 id; expansion handoff idempotent; expansion does not call billing/entitlement; cross-portfolio write denied
- [ ] **Step 2: Run Vitest** — expect FAIL
- [ ] **Step 3: Implement** + thin UI tabs
- [ ] **Step 4: Re-run Wave 1+2+3** — PASS
- [ ] SDD review gate before Wave 4

---
