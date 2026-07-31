# Phase 12 Final Report — Sales Pipeline & Opportunity Management

**Decision:** **READY_FOR_PHASE_13_WITH_BLOCKERS**

**Date:** 2026-07-30

**Working tree:** Phase 12 Waves 0–4 delivered in-place on branch `v2` (no git commit required for Wave 4 exit). Phases 7–11 remain in the same working tree.

Sales Pipeline ships authorised System Admin surfaces for **versioned Pipelines** (`NEW_BUSINESS`, `EXPANSION`, `MRA_EIS`), **CrmOpportunity** create from Phase 11 READY handoffs + audited import, governed stage transitions, non-binding commercial estimates, explainable probability, board/list/My Pipeline, win/loss with Closed Won evidence (no provision), proposal/conversion readiness handoffs only, Opportunity duplicate candidates + SoD merge, and currency-separated Pipeline reporting + audited schedules. Weighted Pipeline UI/reports remain dark until Phase 16.

## Delivered

| Wave | Focus | Status |
|------|-------|--------|
| 0 | Forensic audits + matrices + CONDITIONAL GO | Done |
| 1 | NEW_BUSINESS Pipeline + Opportunity create + transitions | Done |
| 2 | Contact roles, products, commercial, probability, close dates | Done |
| 3 | Board/UI, risks/tasks/timeline, win/loss, readiness handoffs | Done |
| 4 | EXPANSION/MRA_EIS, duplicates/merge, import, reports, Phase 13 pack | Done |

## Surfaces (Wave 4)

### Libraries

- `lib/admin/crm/pipeline/catalogue.js` + `definitions.js` — ACTIVE `NEW_BUSINESS` / `EXPANSION` / `MRA_EIS` (versioned; shared stage codes; pipeline-specific entry criteria)
- `lib/admin/crm/opportunities/duplicates.js` — Opportunity duplicate candidates (same Account / overlapping commercial / same handoff key); never auto-merge
- `lib/admin/crm/merge.js` — Opportunity SoD merge (`entityType: OPPORTUNITY`); requester ≠ approver; evidence JSON
- `lib/admin/crm/opportunities/import.js` — preview + confirm; idempotent `importIdempotencyKey`; honesty gates
- `lib/admin/crm/opportunities/reports.js` + `reportSchedules.js` — Pipeline reporting centre + audited schedules
- `lib/admin/crm/foundations.js` — IMPORT / REPORTING / OPPORTUNITY_PIPELINE → READY; Email/WhatsApp stay NOT_AVAILABLE; weighted dark

### Prisma / SQL

- `CrmOpportunity.importIdempotencyKey`, `mergedIntoOpportunityId`
- `CrmOpportunityDuplicateCandidate`, `CrmPipelineReportSchedule`, `CrmPipelineReportRun`
- Optional ACTIVE EXPANSION / MRA_EIS pipeline seeds
- Fallback: `scripts/sql/crm-pipeline-phase12-wave4.sql`

### APIs

- Pipelines list (all three catalogue codes)
- Opportunity duplicates detect/list/review
- Merge request/approve/execute (Opportunity entity)
- Opportunity import preview/confirm
- Pipeline reports + report schedules create/list/run

### UI

- `/insightbooks/crm/imports` — Opportunity import preview/confirm
- `/insightbooks/crm/reports` — Lead export + Pipeline report + schedules
- Weighted amounts remain dark (Phase 16)

## Hard rules preserved

- Opportunity ≠ Lead ≠ Customer ≠ Subscription ≠ Proposal ≠ Invoice
- Opportunity value ≠ Phase 6 Revenue / MRR / ARR
- Currency explicit; multi-currency totals separated or UNAVAILABLE (no silent FX)
- Stage transitions server-governed for imported + merged records
- Closed Won evidence required; no Tenant / Subscription / Invoice create
- No fabricated funnel % or import success rates; empty reports → EMPTY/UNAVAILABLE envelopes
- Weighted calc may exist; UI/report flag OFF until Phase 16
- Support ≠ CRM; analytics-pipeline ≠ sales Pipeline

## Verification

```bash
npx vitest run \
  test/systemAdmin.crm.opportunityWave4.test.js \
  test/systemAdmin.crm.opportunityWave3.test.js \
  test/systemAdmin.crm.opportunityWave2.test.js \
  test/systemAdmin.crm.opportunities.test.js \
  test/systemAdmin.crm.pipeline.test.js
```

**Result (2026-07-30):** Test Files 6 passed (6) · Tests 68 passed (68) — Wave 4 (14) + Waves 1–3 opportunity/pipeline + Phase 11 foundations assertion update.

## Known blockers for Phase 13

1. **Weighted Pipeline UI / reports** — deferred to Phase 16 (`WEIGHTED_PIPELINE_UI_ENABLED = false`)
2. **Owner / team / territory list scope filtering** — `resolveCrmScope` still `mode: 'all'` stub
3. **Competitor / partner Opportunity depth** — optional; still deferred if not in Phase 13 core
4. **Account / Contact merge** — remains `NOT_AVAILABLE` (Lead + Opportunity merge executed)
5. **Email / WhatsApp → Lead ingest** — still `NOT_AVAILABLE`
6. **Lead → Tenant conversion transaction** — CARRY (Closed Won ≠ provision)
7. **Prisma generate / db push on Windows** — schema + SQL ready; apply when EPERM clears
8. **Rich duplicates admin UI** — thin stub; Opportunity duplicate APIs exist

## Exit readiness

**READY_FOR_PHASE_13_WITH_BLOCKERS** — Phase 12 Waves 1–4 deliver honest Pipeline/Opportunity ops including EXPANSION/MRA_EIS, import, currency-separated reports, and SoD merge; weighted forecasting UI, full scope filtering, and provisioning/conversion remain explicit carry blockers.
