# Task P12-4 Implementer Report

**Status:** DONE_WITH_CONCERNS

**Task:** Phase 12 Wave 4 — Extra Pipelines + duplicates/merge + import + reports + Phase 13 pack  
**Date:** 2026-07-30  
**Branch / tree:** `v2` WORKING_TREE — **no git commit**

## Files created / modified

### Created
- `lib/admin/crm/opportunities/duplicates.js`
- `lib/admin/crm/opportunities/import.js`
- `lib/admin/crm/opportunities/reports.js`
- `lib/admin/crm/opportunities/reportSchedules.js`
- `scripts/sql/crm-pipeline-phase12-wave4.sql`
- `app/api/admin/crm/opportunities/duplicates/route.js`
- `app/api/admin/crm/opportunities/import/route.js`
- `app/api/admin/crm/pipeline/reports/route.js`
- `app/api/admin/crm/pipeline/report-schedules/route.js`
- `components/admin/crm/CrmOpportunityImportView.jsx`
- `components/admin/crm/CrmPipelineReportsView.jsx`
- `test/systemAdmin.crm.opportunityWave4.test.js`
- `docs/admin-intelligence-crm/phase-12/FINAL_PHASE_12_REPORT.md`
- `docs/admin-intelligence-crm/phase-12/PHASE_13_INPUTS.md`
- `docs/admin-intelligence-crm/phase-12/PHASE_13_READINESS_CHECKLIST.md`
- `.superpowers/sdd/task-p12-4-report.md` (this file)

### Modified
- `lib/admin/crm/pipeline/catalogue.js` — EXPANSION / MRA_EIS codes + versions; Opportunity `MERGED` status
- `lib/admin/crm/pipeline/definitions.js` — ACTIVE EXPANSION / MRA_EIS definitions + catalogue list
- `lib/admin/crm/pipeline/index.js` — list all three pipelines; export new helpers
- `lib/admin/crm/catalogue.js` — `CRM_MERGE_ENTITY.OPPORTUNITY`; `CRM_FOUNDATION_STATUS.READY`
- `lib/admin/crm/merge.js` — Opportunity SoD request/approve/execute + evidence
- `lib/admin/crm/foundations.js` — IMPORT / REPORTING / OPPORTUNITY_PIPELINE → READY
- `lib/admin/crm/opportunities/model.js` — serialize import/merge fields
- `lib/admin/crm/opportunities/index.js` — Wave 4 exports
- `lib/admin/crm/index.js` — Wave 4 public surface exports
- `prisma/schema.prisma` — import/merge fields + duplicate/schedule/run models + Admin relations
- `app/api/admin/crm/merge/route.js` — entity-aware not-found message
- `app/insightbooks/crm/imports/page.js` — Opportunity import view
- `components/admin/crm/CrmReportsView.jsx` — re-export Pipeline reports view
- `components/admin/index.js` — export new CRM views
- `locales/en/admin-pages.json` / `locales/ny/admin-pages.json` — import/report copy
- `test/systemAdmin.crm.wave4.test.js` — foundations READY expectations (Phase 11 suite)

## Tests run + results

```bash
npx vitest run \
  test/systemAdmin.crm.opportunityWave4.test.js \
  test/systemAdmin.crm.opportunityWave3.test.js \
  test/systemAdmin.crm.opportunityWave2.test.js \
  test/systemAdmin.crm.opportunities.test.js \
  test/systemAdmin.crm.pipeline.test.js \
  test/systemAdmin.crm.wave4.test.js
```

**Result:** Test Files **6 passed** (6) · Tests **66 passed** (66)

## Acceptance checklist

- [x] EXPANSION + MRA_EIS Pipelines ACTIVE in catalogue (and seedable via SQL)
- [x] Opportunity duplicate candidates + SoD merge (no silent merge)
- [x] Import idempotent; honesty gates; currency/basis required
- [x] Reports currency-separated; no false zeroes; schedules audited
- [x] Weighted service OK; UI/report flag OFF
- [x] FINAL_PHASE_12_REPORT + PHASE_13_INPUTS + PHASE_13_READINESS_CHECKLIST
- [x] Exit READY_FOR_PHASE_13_WITH_BLOCKERS
- [x] Vitest PASS (Wave 4 + prior opportunity suites)

## Concerns / carry blockers for Phase 13

1. **Prisma generate EPERM (Windows)** — schema + `scripts/sql/crm-pipeline-phase12-wave4.sql` shipped; runtime uses `hasCrm*Model` guards until client regenerates.
2. **Owner/team/territory scope** — still `resolveCrmScope` stub (`mode: 'all'`).
3. **Weighted UI/reports** — intentionally dark until Phase 16.
4. **Merge execute is not a single DB transaction** — Lead merge pattern reused (best-effort history/candidate updates after loser status write); same non-transactional concern as Phase 11.
5. **Duplicates UI** — Opportunity duplicate APIs exist; `/insightbooks/crm/duplicates` remains a thin Lead-oriented stub.
6. **Account/Contact merge** — still `NOT_AVAILABLE`.
7. **Optional competitor/partner** — deferred.
8. **Email/WhatsApp ingest** — remain `NOT_AVAILABLE`.

## Self-review notes

- Closed Won ≠ provision preserved; import/confirm sets `provisioned: false`.
- Import honesty: `successRate` always `null`; validation fail-closed before confirm.
- Empty reports return `status: 'EMPTY'` with null counts (not invented zeroes).
- Catalogue always surfaces all three pipeline codes even when DB partial.
- Do not commit (WORKING_TREE only).

## Post-review fixes

Addressed Phase 12 Task 4 review Important findings (no git commit):

1. **Terminal stages on import** — `validateOpportunityImportRow` now rejects `CLOSED_WON` / `CLOSED_LOST` with `TERMINAL_STAGE_USE_CLOSE_SERVICE` so import cannot create OPEN+CLOSED_* rows that bypass close evidence.
2. **EXPANSION `existing_account`** — EXPANSION rows without `accountId` fail closed with `EXPANSION_ACCOUNT_REQUIRED` (MRA_EIS contact not required on import).

**Wave 4 re-run:** `npx vitest run test/systemAdmin.crm.opportunityWave4.test.js` → **14 passed** (14).
