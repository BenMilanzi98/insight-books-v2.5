### Task 4: Wave 4 — Handoffs, hubs, reports, weighted UI, Phase 17 pack

**Depends on:** Tasks 1–3 complete.

**Do NOT git commit.**

## Goal

CS assignment + onboarding/training/migration/MRA EIS handoffs (idempotent; no full execution), completion certificate, conversion hubs/reports/DQ/recon/reliability gate, unlock weighted Pipeline UI behind honesty/currency gates, exit docs (`FINAL_PHASE_16_REPORT`, `PHASE_17_INPUTS`, `PHASE_17_READINESS_CHECKLIST`, update `FINAL_READINESS_DECISION`). Expect **`READY_FOR_PHASE_17_WITH_BLOCKERS`**. Vitest green.

## Files

Create under `lib/admin/crm/conversions/`:
- `customerSuccess.js`, `onboardingHandoff.js`, `trainingHandoff.js`, `migrationHandoff.js`, `mraEisHandoff.js`, `completion.js`, `reports.js`, `dataQuality.js`, `reconciliation.js`, `metrics.js`, `reliabilityGate.js`
- Modify: `lib/admin/crm/opportunities/commercial.js` — enable weighted UI via gated accessor (honesty + currency); never claim Revenue
- `scripts/sql/crm-conversion-phase16-wave4.sql` as needed
- UI: conversion overview/queues/my-work/detail extensions; conversion-reports thin OK
- Exit docs under `docs/admin-intelligence-crm/phase-16/`
- Test: `test/systemAdmin.crm.conversionWave4.test.js`

## Interfaces

```js
assignCustomerSuccessOwner(...)
createOnboardingHandoff / createTrainingHandoff / createDataMigrationHandoff / createMraEisHandoff // idempotent
finalizeConversion + completion certificate checksum
getConversionMetric / reports with reliability gate (fail ≠ 0)
// WEIGHTED_PIPELINE_UI: gated unlock — indicative only
```

## TDD

- Handoff retry → same id; no fabricated onboarding complete
- Recon/metric gate fail ≠ fabricated 0
- Weighted UI gated (honesty/currency)
- Certificate checksum stable
- Compensation does not delete acceptance evidence

## Hard rules

- Handoffs ≠ full execution
- No MRA fiscal/credentials
- No false zeroes
- Exit READY_FOR_PHASE_17_WITH_BLOCKERS with payment/provider blockers explicit
- No commit

## Acceptance

- [ ] Vitest Wave 4 PASS
- [ ] Handoffs idempotent
- [ ] Weighted UI honesty-gated
- [ ] Exit docs + readiness recorded
- [ ] No commit

## Report

`.superpowers/sdd/task-p16-4-report.md` with RED/GREEN + recorded exit state. Return status + test summary + concerns + exit state + path.
