### Task 1: Wave 1 — Request, readiness, dry-run, plan, orchestrator spine, Closed Won early

**Depends on:** Task 0 CONDITIONAL GO.

**Do NOT git commit.**  
**Do NOT implement:** Customer/Tenant/Subscription/Invoice create (Waves 2–3). Wave 1 may create durable Conversion/Step rows + Closed Won transition only.

## Goal

Ship Conversion Request + readiness + dry-run + versioned Plan + durable orchestrator/step spine with exact/conflicting retry, resume of completed validate steps, and Phase 12 Closed Won at start of durable execution. Thin API/UI stubs. Vitest green.

## Files

Create `lib/admin/crm/conversions/`:
- `catalogue.js`, `numbering.js`, `requests.js`, `readiness.js`, `plan.js`, `dryRun.js`, `orchestrator.js`, `steps.js`, `status.js`, `model.js`, `index.js`

Also:
- `scripts/sql/crm-conversion-phase16-wave1.sql`
- Prisma: CrmConversionRequest, Plan(+version), CrmConversion, Step, Attempt, Failure (+ status history as needed)
- Thin APIs: `app/api/admin/crm/conversion-requests/**`, `conversions/**`
- Thin UI: `app/insightbooks/crm/conversions/**`
- Export from `lib/admin/crm/index.js`
- Wire Phase 15 handoff → `createConversionRequest` (idempotent)
- Test: `test/systemAdmin.crm.conversionWave1.test.js` (mock prisma like commercialWave1)

## Interfaces

```js
createConversionRequest({ actorContext, source, acceptanceId, opportunityId, …, idempotencyKey })
evaluateConversionReadiness({ conversionRequestId | acceptanceId })
createConversionPlan / dryRunConversion // dry run: NO Customer/Tenant/Subscription/Invoice/invite/handoff; NO Opp stage change
executeClosedWonConversion({ actorContext, conversionRequestId, conversionPlanVersionId, idempotencyKey })
// → lock; validate; Closed Won via Phase 12 closeOpportunityWon / transition ONCE at durable start
// → persist step rows for validate + closed-won; later provision steps NOT_STARTED or SKIPPED_NOT_APPLICABLE this wave
// exact retry → existing CVN; conflicting input hash → fail
resumeConversion({ conversionId, idempotencyKey }) // skip completed steps
```

Numbers: `CVR-YYYY-######`, `CVN-YYYY-######`.

## TDD (must cover)

- Request numbering unique
- Phase 15 handoff → CVR idempotent
- Dry-run does not create Customer/Tenant/Subscription or change Opp stage
- Execute Closed Won once via Phase 12 (assert closeOpportunityWon / no direct status edit)
- Exact retry no duplicate conversion
- Conflicting retry fails
- Resume skips completed validate/closed-won step

## Hard rules

- Early Closed Won retained on later failure (document; Wave 1 may simulate failed later step without reopen)
- No Tenant GL; no fabricate PAID/ACTIVE
- hasCrm*Model + SQL fallback
- No commit

## Acceptance

- [ ] Vitest Wave 1 PASS with listed cases
- [ ] Dry-run side-effect free
- [ ] Closed Won via Phase 12 only, once
- [ ] Idempotent exact retry; conflicting fails
- [ ] Thin routes exist
- [ ] No Wave 2–3 provision; no commit

## Report

`.superpowers/sdd/task-p16-1-report.md` with RED/GREEN. Return status + test summary + concerns + path.
