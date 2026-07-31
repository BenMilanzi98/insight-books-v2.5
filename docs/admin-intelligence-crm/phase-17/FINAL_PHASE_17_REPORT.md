# Final Phase 17 Report — Customer Onboarding

**Date:** 2026-07-31  
**Exit decision:** `READY_FOR_PHASE_18_WITH_BLOCKERS`  
**Working tree:** in-place (no git commit required for wave close)

## Summary

Phase 17 delivers one authoritative Customer Onboarding plane (Request + Project spine) that consumes Phase 16 ONBOARDING handoffs and manages Customers from validation through kick-off, workstreams/tasks/evidence, readiness coordination, go-live → stabilisation → handover → completion certificate — without fabricating Customer actions, posting Tenant GL, executing Training/migration engines, or inventing KPI zeroes.

| Wave | Delivered |
|------|-----------|
| 0 | Forensic audits, gap register, CONDITIONAL GO |
| 1 | Request/Project models, numbering, handoff consume, accept/reject/convert, idempotency |
| 2 | Templates/materialisation, kick-off↔Meeting, stakeholders, tasks/evidence, scope/CR |
| 3 | Readiness, migration/MRA/training coord, testing/defects, go-live→stabilisation→handover→certificate |
| 4 | UI hubs, metrics/reliability, DQ/recon/lineage, reports/exports, Phase 8 link, Phase 18 pack, EN+NY |

## Wave 4 highlights

- Overview / My Work / queues / Context Bar / Request+Project list-detail (thin AdminShell)
- `metrics.js`, `reliabilityGate.js`, `dataQuality.js`, `reconciliation.js`, `lineage.js`, `reports.js`, `exports.js` (+ notifications/search/cache stubs)
- Gate fail → `UNAVAILABLE` / `value: null` — never false zero
- Phase 8: `CsOnboardingRecord.onboardingProjectId` when resolvable; else UNKNOWN; foundations project Project status
- SQL: `scripts/sql/cs-onboarding-phase17-wave4.sql`
- Vitest: `test/systemAdmin.cs.onboardingWave4.test.js` + Waves 1–3 regression

## Explicit blockers for Phase 18

- Customer evidence portal not configured
- Training execution / certificates / assessments (Phase 18)
- Full migration engine
- MRA EIS Production fiscal / credential store
- Payment / e-sign providers (Phase 16 carry)

## Verification

See `.superpowers/sdd/task-4-report.md` for RED/GREEN evidence and test counts.

## Next

Phase 18 Customer Training Management may consume training coordination + certificates under documented blockers. See `PHASE_18_INPUTS.md` and `PHASE_18_READINESS_CHECKLIST.md`.
