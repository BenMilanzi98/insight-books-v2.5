### Task 4: Wave 4 — UI hubs, metrics/reliability, DQ/recon, reports, Phase 8 migrate, Phase 18 pack

**Files:**
- Create/extend: Overview, My Work, Team, Calendar, queues, Context Bar, Request list/detail, Project list/detail tabs, Templates UI, Reports
- Create: `metrics.js`, `reliabilityGate.js`, `dataQuality.js`, `reconciliation.js`, `lineage.js`, `reports.js`, `exports.js`, `notifications.js`, `search.js`, `cache.js`
- Create: `scripts/sql/cs-onboarding-phase17-wave4.sql` as needed (snapshots, report schedules, Phase 8 link column)
- Modify: `lib/admin/customerSuccess/foundations.js` — project Project when `onboardingProjectId` present
- Docs: full `docs/admin-intelligence-crm/phase-17/` deliverables including `PHASE_18_INPUTS.md`, `PHASE_18_READINESS_CHECKLIST.md`, `FINAL_PHASE_17_REPORT.md`, `FINAL_READINESS_DECISION.md`
- i18n: en + ny keys for onboarding surfaces
- Test: `test/systemAdmin.cs.onboardingWave4.test.js`

**Interfaces:**
- Produces:
  - Overview cards via reliability gate — gate fail → `UNAVAILABLE` / `value: null` (never `0` as fake empty)
  - My Work scoped counts
  - Report catalogue subset for Wave 4 (Overview, At-Risk, Overdue Customer Tasks, Go-Live Readiness, Completion) + CSV/XLSX export path with permission recheck
  - Global search index entries for ONB/ONR numbers (no migration file contents, no credentials)
  - Phase 8 migrate: link existing `CsOnboardingRecord` → Project where resolvable; else leave UNKNOWN
  - Exit readiness `READY_FOR_PHASE_18_WITH_BLOCKERS`

- [ ] **Step 1: Write failing Vitest** — gate fail not zero; portfolio scope excludes other CS owner projects; search excludes inaccessible ONB; export strips credentials; Phase 8 linked record projects Project status; EN key resolve (smoke); certificate still idempotent after Wave 4
- [ ] **Step 2: Run Vitest** — expect FAIL
- [ ] **Step 3: Implement** UI + metrics + DQ/recon + docs + Phase 8 link migration
- [ ] **Step 4: Re-run Vitest** — PASS; run `npx vitest run test/systemAdmin.cs.onboardingWave{1,2,3,4}.test.js` regression
- [ ] Produce FINAL reports + Phase 18 input pack; set exit state
- [ ] SDD final review

---
