# Task P16-4 Report — Wave 4 Handoffs / hubs / reports / weighted UI / Phase 17 pack

**Status:** COMPLETE  
**Date:** 2026-07-31  
**Commits:** none (per brief)

## TDD

### RED

```text
npx vitest run test/systemAdmin.crm.conversionWave4.test.js
→ Test Files 1 failed · Tests 6 failed (6)
→ TypeError: createOnboardingHandoff / assignCustomerSuccessOwner /
  applyConversionReportHonesty / finalizeConversion / compensateConversionArtifacts
  is not a function
→ WEIGHTED_PIPELINE_UI_ENABLED expected true, received false
```

### GREEN

```text
npx vitest run test/systemAdmin.crm.conversionWave4.test.js
→ Test Files 1 passed (1)
→ Tests 6 passed (6)

npx vitest run test/systemAdmin.crm.conversionWave1.test.js \
  test/systemAdmin.crm.conversionWave2.test.js \
  test/systemAdmin.crm.conversionWave3.test.js \
  test/systemAdmin.crm.conversionWave4.test.js \
  test/systemAdmin.crm.opportunityWave2.test.js \
  test/systemAdmin.crm.opportunityWave3.test.js \
  test/systemAdmin.crm.opportunityWave4.test.js
→ Test Files 7 passed (7)
→ Tests 74 passed (74)
```

## Delivered

| Area | Path |
|------|------|
| CS assignment | `lib/admin/crm/conversions/customerSuccess.js` |
| Onboarding handoff | `lib/admin/crm/conversions/onboardingHandoff.js` |
| Training handoff | `lib/admin/crm/conversions/trainingHandoff.js` |
| Migration handoff | `lib/admin/crm/conversions/migrationHandoff.js` |
| MRA EIS handoff | `lib/admin/crm/conversions/mraEisHandoff.js` |
| Completion + compensate | `lib/admin/crm/conversions/completion.js` |
| Reports / metrics / gate | `reports.js`, `metrics.js`, `reliabilityGate.js` |
| DQ / recon | `dataQuality.js`, `reconciliation.js` |
| Hub keys | `hubKeys.js` |
| Weighted UI gate | `lib/admin/crm/opportunities/commercial.js` `resolveWeightedPipelineUiAccess` |
| SQL | `scripts/sql/crm-conversion-phase16-wave4.sql` |
| Prisma | CsAssignment / DomainHandoff / CompletionCertificate / DqIncident / ReconRun |
| UI stubs | conversions overview/queues/my-work + conversion-reports |
| Exit docs | `FINAL_PHASE_16_REPORT.md`, `PHASE_17_INPUTS.md`, `PHASE_17_READINESS_CHECKLIST.md`, `FINAL_READINESS_DECISION.md` |
| Tests | `test/systemAdmin.crm.conversionWave4.test.js` |

## Acceptance coverage

- [x] Vitest Wave 4 PASS (handoff retry same id; no fabricated onboarding complete; recon/metric gate fail ≠ 0; weighted UI honesty/currency gated; certificate checksum stable; compensation does not delete acceptance)
- [x] Handoffs idempotent; executionStatus NOT_STARTED; no MRA fiscal/credentials
- [x] Weighted UI honesty-gated (indicative ≠ Revenue)
- [x] Exit docs + readiness recorded: **READY_FOR_PHASE_17_WITH_BLOCKERS**
- [x] No git commit

## Self-review

- Domain handoffs always emit `executionStatus: NOT_STARTED`; never accept fabricated COMPLETED for onboarding/training.
- MRA handoff returns `fiscalSubmitted: false` / `credentialsStored: false`.
- Metric/report/DQ/recon gate failures return `value: null` / `checks: null` / `cards: null` — never fabricated 0.
- `resolveWeightedPipelineUiAccess` requires honesty + currency; capability flag true does not alone unlock UI.
- Completion certificate checksum is deterministic over conversionId + acceptanceId + documentVersionId + acceptanceChecksum + tenantId.
- `compensateConversionArtifacts` never calls acceptance delete/deleteMany; returns `acceptancePreserved: true`.

## Concerns

1. Wave 4 Prisma tables require SQL apply or `prisma db push` before production; Windows EPERM may still need SQL fallback.
2. Payment provider remains NOT_CONFIGURED — AFTER_PAYMENT activation stays deferred until Phase 17 provider callback.
3. Full onboarding/training/migration/MRA execution is intentionally out of scope; handoffs only.
4. Conversion UI hubs are thin stubs; services/APIs are the Wave 4 truth surface.
5. `resolveCrmScope` still `mode: 'all'` stub (carry blocker).

## Exit readiness state

**READY_FOR_PHASE_17_WITH_BLOCKERS**

## Report path

`.superpowers/sdd/task-p16-4-report.md`

## Fix wave (Important)

**Date:** 2026-07-31  
**Source:** `task-p16-4-review.md` Important #1–#2  
**Commits:** none

### Fixes

1. **Commercial API gated `weightedUiEnabled`** — `getOpportunityCommercial` / `setOpportunityCommercial` return honesty/currency-gated unlock via `resolveWeightedPipelineUiAccess`; capability exposed separately as `weightedUiCapability`. Commercial route no longer returns raw `WEIGHTED_PIPELINE_UI_ENABLED` as unlock; `isRevenue: false` always. Indicative ≠ Revenue.
2. **Handoff payload forge hardening** — onboarding/training/migration/MRA handoffs force completion/fiscal flags **after** `...(args.payload)` (`onboardingCompleted`/`trainingCompleted`/`executionComplete`/`productionImportExecuted`/`fiscalSubmitted`/`credentialsStored`/`mraEisFiscalSubmitted` all forced false). `handoffShared` also re-forces `executionStatus: NOT_STARTED` / `executionComplete: false` after spread.

### Vitest

```text
npx vitest run test/systemAdmin.crm.conversionWave4.test.js
→ Test Files 1 passed (1)
→ Tests 8 passed (8)
```

Added coverage:
- commercial surface never exposes ungated `weightedUiEnabled: true` (capability true ≠ unlock)
- stored handoff `payloadJson` cannot forge fiscal/execution completion flags
