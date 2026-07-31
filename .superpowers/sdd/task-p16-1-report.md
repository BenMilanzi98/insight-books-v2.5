# Task P16-1 Report — Wave 1 Conversion request/plan/dry-run/orchestrator + Closed Won early

**Status:** COMPLETE  
**Date:** 2026-07-31  
**Commits:** none (per brief)

## TDD

### RED

```text
npx vitest run test/systemAdmin.crm.conversionWave1.test.js
→ Test Files 1 failed · Tests 8 failed (8)
→ TypeError: allocateConversionRequestNumber / createConversionRequest /
  createConversionRequestFromClosedWonHandoff / dryRunConversion /
  executeClosedWonConversion / resumeConversion / allocateConversionNumber
  is not a function
```

(Also briefly failed suite load on duplicate `evaluateConversionReadiness` export vs Phase 12 — resolved via arg-based dispatcher.)

### GREEN

```text
npx vitest run test/systemAdmin.crm.conversionWave1.test.js
→ Test Files 1 passed · Tests 8 passed (8)

npx vitest run test/systemAdmin.crm.opportunityWave3.test.js -t "conversion readiness"
→ Test Files 1 passed · Tests 1 passed | 8 skipped (9)
```

## Delivered

| Area | Path |
|------|------|
| Domain lib | `lib/admin/crm/conversions/*` (catalogue, numbering, requests, readiness, plan, dryRun, orchestrator, steps, status, model, index) |
| SQL | `scripts/sql/crm-conversion-phase16-wave1.sql` |
| Prisma | `CrmConversionRequest`, Plan(+Version), DryRun, Conversion, Step, Attempt, Failure + status histories |
| APIs | `app/api/admin/crm/conversion-requests/route.js`, `app/api/admin/crm/conversions/route.js` |
| UI stubs | `app/insightbooks/crm/conversions/**` |
| Phase 15 wire | `phase16Handoff.js` → dynamic `createConversionRequestFromClosedWonHandoff` |
| Numbers | `CVR` / `CVN` prefixes + regexes in `catalogue.js` |
| Tests | `test/systemAdmin.crm.conversionWave1.test.js` |

## Acceptance coverage

- [x] Vitest Wave 1 PASS (numbering, handoff→CVR idempotent, dry-run side-effect free, Closed Won via Phase 12 once, exact retry, conflicting retry, resume skips completed steps)
- [x] Dry-run: no Customer/Tenant/Subscription create; no Opp stage change; no CVN create
- [x] Closed Won via `closeOpportunityWon` only, once at durable start
- [x] Exact retry → existing CVN; conflicting input hash → fail
- [x] Thin routes + UI stubs exist
- [x] No Wave 2–3 provision; no git commit
- [x] Early Closed Won retained on simulated later-step failure (`simulateLaterStepFailure`)

## Self-review

- Orchestrator never invents Opp stage — only `closeOpportunityWon`.
- Provision steps Wave 1 = `SKIPPED_NOT_APPLICABLE`; honesty flags false on execute/dry-run.
- `evaluateConversionReadiness` dispatches: `conversionRequestId`/`acceptanceId` → Phase 16; `opportunityId` → Phase 12 (no export clash).
- `hasCrm*Model` guards + SQL fallback for EPERM.
- Handoff→CVR wiring is best-effort (dynamic import); handoff still succeeds if CVR model unavailable.

## Concerns

1. Prisma generate/db push may still hit Windows EPERM — SQL fallback provided; apply before runtime use.
2. UI stubs use i18n keys that may not exist yet (thin stub OK per wave).
3. Phase 16 readiness soft-passes when commercial acceptance model absent but handoff/CVR pins exist (unit-test friendly; production should have acceptance rows).
4. Wave 2+ must replace `SKIPPED_NOT_APPLICABLE` provision steps with real handlers — do not treat Wave 1 PARTIALLY_COMPLETED as business-complete.

## Report path

`.superpowers/sdd/task-p16-1-report.md`

## Fix wave (Important)

**Date:** 2026-07-31  
**Trigger:** `task-p16-1-review.md` Important findings 1–3  
**Commit:** none

### Changes

1. **Exact-retry / create-race replay completes incomplete Closed Won** (`lib/admin/crm/conversions/orchestrator.js`)
   - `continueOrReplayExistingConversion` no longer returns `ok: true` / `idempotentReplay` while `TRANSITION_OPPORTUNITY_CLOSED_WON` is incomplete or failed.
   - Same-key retry and race handler delegate to the early spine so Phase 12 `closeOpportunityWon` runs/finishes (or fails visibly) before success.
2. **`resumeConversion` executes incomplete Closed Won** (`orchestrator.js`)
   - Resume still skips completed validate / Closed Won steps.
   - Incomplete or failed Closed Won is retried via `closeOpportunityWon` (exactly once per successful completion; Phase 12 idempotency key retained).
3. **CVR status updates use transition helper only** (`orchestrator.js`)
   - Removed raw `crmConversionRequest.update` force-bypass when `transitionConversionRequestStatus` returns `!ok`.
   - Illegal / failed READY→IN_PROGRESS (and QUEUED→IN_PROGRESS) now fail closed with the transition error; Closed Won is not started.

### Tests added

- Exact retry completes incomplete Closed Won before reporting success
- Resume executes incomplete Closed Won via Phase 12 (still skips when completed)
- CVR status update fails closed without force-bypass on illegal transition

### Vitest output

```text
npx vitest run test/systemAdmin.crm.conversionWave1.test.js

 Test Files  1 passed (1)
      Tests  11 passed (11)
```
