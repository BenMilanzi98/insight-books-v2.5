# Task 3 Report � Phase 17 Wave 3 (Readiness, go-live, stabilisation, handover, completion)

**Status:** DONE  
**Date:** 2026-07-31  
**Working tree:** branch `v2`, in-place (**no git commit**)  
**Domain path:** `lib/admin/customerSuccess/onboarding/**` (extended Wave 1�2; no second domain)

## Summary

Wave 3 ships readiness dimension evaluation (`UNKNOWN` ? `READY`), migration/MRA/training coordination (recon gate; Training COMPLETED needs Phase 18 source), testing/defects (Critical blocks go-live), go-live approve/execute/outcome ? `STABILISATION` (not `COMPLETED`), stabilisation exit, handover create/accept, completion evaluation + checksum certificate (idempotent retry), server-side progress/health, and accounting boundary (no journals/OB/stock). Cross-Tenant project access denied. Thin project tabs + API actions. Vitest Wave 1 + 2 + 3 green.

## TDD evidence

### RED

```text
$ npx vitest run test/systemAdmin.cs.onboardingWave3.test.js

 FAIL  test/systemAdmin.cs.onboardingWave3.test.js (11 tests | 11 failed)
 TypeError: evaluateOnboardingReadiness is not a function
 TypeError: recordOnboardingDefect is not a function
 TypeError: approveGoLive is not a function
 � (migration / training / completion / certificate / accounting / progress / handover likewise missing)
```

Failure reason: Wave 3 exports/modules not implemented (expected before GREEN).

### GREEN

```text
$ npx vitest run test/systemAdmin.cs.onboardingWave3.test.js

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

### Regression (Wave 1 + Wave 2 + Wave 3)

```text
$ npx vitest run test/systemAdmin.cs.onboardingWave1.test.js test/systemAdmin.cs.onboardingWave2.test.js test/systemAdmin.cs.onboardingWave3.test.js

 Test Files  3 passed (3)
      Tests  34 passed (34)
```

### Cases covered

| Case | Result |
|------|--------|
| UNKNOWN readiness blocks go-live (UNKNOWN ? READY) | PASS |
| Critical defect blocks go-live approval | PASS |
| Successful go-live ? STABILISATION not COMPLETED | PASS |
| Migration COMPLETED rejected without reconciliation | PASS |
| Training COMPLETED rejected without Training-domain source | PASS |
| Completion without Customer sign-off fails | PASS |
| Completion certificate checksum stable on exact retry | PASS |
| Accounting boundary � no journals/OB/stock from onboarding | PASS |
| Cross-Tenant project access denied | PASS |
| Progress/health server-side, versioned; progress ? completion | PASS |
| Handover create/accept | PASS |

## Deliverables

### Lib (`lib/admin/customerSuccess/onboarding/`)

| File | Role |
|------|------|
| `projectAccess.js` | Project load + Cross-Tenant isolation |
| `readiness/tenant.js` � `configuration.js` / `accounting.js` | Dimension evaluators |
| `readiness/evaluate.js` | `evaluateOnboardingReadiness` � UNKNOWN ? READY |
| `accountingBoundary.js` | No journal/OB/stock create; side-effect assert |
| `migration.js` | Coordination SM; recon gate on COMPLETED |
| `mraEis.js` | Credential-status boundary only |
| `training.js` | Phase 16 handoff consume; COMPLETED needs Phase 18 source |
| `testing.js` / `defects.js` | Plans + Critical severity gate |
| `goLive.js` | `approveGoLive` / `executeGoLive` / `recordGoLiveOutcome` ? STABILISATION |
| `stabilisation.js` | Exit criteria + approval |
| `handover.js` | Create / accept |
| `completion.js` | Evaluation + checksum certificate (idempotent) |
| `progress.js` / `health.js` | Server-side versioned rules; no ML |
| `catalogue.js` / `model.js` / `index.js` | Wave 3 contract + guards + exports |

### Prisma / SQL

- Models appended to `prisma/schema.prisma` (ReadinessEvaluation, Migration, MraEis, Training, TestPlan, Defect, GoLive, GoLiveApproval, Stabilisation, Handover, Completion, CompletionCertificate, Risk, Issue, Document metadata)
- SQL fallback: `scripts/sql/cs-onboarding-phase17-wave3.sql`

### Thin API / UI

- `app/api/admin/customer-success/onboarding/route.js` � Wave 3 POST actions
- UI tabs under `app/insightbooks/customer-success/onboarding/projects/[id]/{readiness,migration,training,testing,go-live,stabilisation,handover,completion}`

## Constraints honored

- [x] Extend Wave 1�2 domain; no fork
- [x] UNKNOWN readiness ? READY; blocks go-live
- [x] Critical defects block go-live approval
- [x] Successful go-live ? STABILISATION not COMPLETED
- [x] Migration COMPLETED rejected without recon
- [x] Training COMPLETED rejected without Training-domain source
- [x] Completion needs sign-offs + recon + handover; certificate checksum; exact retry same certificate
- [x] Accounting boundary: no journal/OB/stock from onboarding
- [x] Cross-Tenant project access denied
- [x] Gate honesty: never fabricate go-live/completion
- [x] No git commit

## Concerns / follow-ups

- Prisma `generate` / `db push` may hit Windows EPERM � use `scripts/sql/cs-onboarding-phase17-wave3.sql` fallback; model guards keep APIs UNAVAILABLE until models exist.
- Full UI hubs, reliability gate metrics, DQ/recon/lineage, Phase 8 migrate, Phase 18 input pack remain Wave 4.
- SDD review gate before Wave 4.

## Exit for Wave 3 stop gate

**CONDITIONAL GO** for Wave 4 � no false go-live/completion in delivered services; accounting boundary holds; Critical/High honesty rules covered by Vitest.

## Fix wave

**Date:** 2026-07-31  
**Trigger:** Task 3 review Critical + Important findings  
**No git commit**

### Fixes

| Finding | Change |
|---------|--------|
| Critical: stored READY snapshot lifts live UNKNOWN ? READY | Removed snapshot merge/lift in `readiness/evaluate.js`; stored eval is audit-only; fresh dims never promoted from history |
| Important: training `IN_PROGRESS` treated as READY | `evaluateTrainingDim` � only Training-domain COMPLETED or NOT_REQUIRED / WAIVED_WITH_APPROVAL / NOT_APPLICABLE; stub IN_PROGRESS/UNKNOWN stay non-READY |
| Important: execute/outcome skip readiness re-check | `executeGoLive` + `recordGoLiveOutcome(SUCCESSFUL)` call `requireCurrentReadiness` (READY / READY_WITH_WARNINGS only) |
| Important: SUCCESSFUL can return ok without STABILISATION | Outcome fails with `go_live_stabilisation_transition_failed` if final status ? STABILISATION |
| Important: accounting boundary fails on ambient tenant GL | `assertOnboardingAccountingBoundary` fails only on onboarding-authored side effects; create-deny retained; ambient journals OK |

### Tests

```text
$ npx vitest run test/systemAdmin.cs.onboardingWave1.test.js test/systemAdmin.cs.onboardingWave2.test.js test/systemAdmin.cs.onboardingWave3.test.js

 Test Files  3 passed (3)
      Tests  37 passed (37)
```

Added Wave 3 cases: stored snapshot never lifts UNKNOWN; training IN_PROGRESS non-READY; execute refuses after readiness regression; ambient journals allowed on accounting boundary. Harness `seedGoLiveReady` uses explicit `dimensionOverrides` + live Training-domain COMPLETED / test plan PASSED (no snapshot lift).
