# Task 4 Report � Phase 17 Wave 4 (UI hubs, metrics/reliability, DQ/recon, reports, Phase 8, Phase 18 pack)

**Status:** DONE  
**Date:** 2026-07-31  
**Working tree:** branch `v2`, in-place (**no git commit**)  
**Domain path:** `lib/admin/customerSuccess/onboarding/**` (extended Waves 1�3; no second domain)  
**Exit readiness:** **`READY_FOR_PHASE_18_WITH_BLOCKERS`**

## Summary

Wave 4 ships Overview / My Work / queues / Context Bar / Request+Project list-detail UI (thin AdminShell), reliability-gated metrics (gate fail ? `UNAVAILABLE` / `value: null` � never false zero), DQ/recon/lineage, report catalogue + credential-stripped exports, search/cache/notification stubs, Phase 8 `CsOnboardingRecord` ? Project link (else UNKNOWN; foundations project Project status � never invent COMPLETED), EN+NY hub keys, SQL fallback, and Phase 18 input pack. Vitest Waves 1�4 green.

## TDD evidence

### RED

```text
$ npx vitest run test/systemAdmin.cs.onboardingWave4.test.js

 FAIL  test/systemAdmin.cs.onboardingWave4.test.js (7 tests | 7 failed)
 TypeError: applyOnboardingReportHonesty is not a function
 TypeError: getOnboardingMyWork is not a function
 TypeError: searchOnboardingIndex is not a function
 TypeError: exportOnboardingReport is not a function
 TypeError: migratePhase8OnboardingRecords is not a function
 AssertionError: EN keys undefined / wave < 4
```

Failure reason: Wave 4 exports/modules/i18n/docs not implemented (expected before GREEN).

### GREEN

```text
$ npx vitest run test/systemAdmin.cs.onboardingWave4.test.js

 Test Files  1 passed (1)
      Tests  7 passed (7)
```

### Regression (Wave 1 + Wave 2 + Wave 3 + Wave 4)

```text
$ npx vitest run test/systemAdmin.cs.onboardingWave1.test.js test/systemAdmin.cs.onboardingWave2.test.js test/systemAdmin.cs.onboardingWave3.test.js test/systemAdmin.cs.onboardingWave4.test.js

 Test Files  4 passed (4)
      Tests  44 passed (44)
```

| Wave | Tests |
|------|------:|
| 1 | 9 |
| 2 | 14 |
| 3 | 14 |
| 4 | 7 |
| **Total** | **44** |

### Cases covered (Wave 4)

| Case | Result |
|------|--------|
| Reliability gate fail ? UNAVAILABLE / value null � never false zero | PASS |
| My Work portfolio scope excludes other CS owner projects | PASS |
| Search excludes inaccessible ONB; no migration files/credentials | PASS |
| Export strips credentials + permission recheck | PASS |
| Phase 8 linked record projects Project status; orphan UNKNOWN; never invent COMPLETED | PASS |
| EN + NY i18n keys resolve (smoke) | PASS |
| Completion certificate still idempotent after Wave 4 | PASS |

## Deliverables

### Lib (`lib/admin/customerSuccess/onboarding/`)

| File | Role |
|------|------|
| `reliabilityGate.js` | Honesty envelope; `safeOnboardingCount`; never invent 0 |
| `metrics.js` | `getOnboardingMetric` / `getOnboardingOverviewCards` |
| `myWork.js` | Owner-scoped My Work |
| `reports.js` | Catalogue: Overview, At-Risk, Overdue Customer Tasks, Go-Live Readiness, Completion |
| `exports.js` | CSV/JSON export; permission recheck; strip credentials |
| `dataQuality.js` / `reconciliation.js` / `lineage.js` | DQ / recon / lineage |
| `search.js` / `cache.js` / `notifications.js` / `hubKeys.js` | Search/cache/notify stubs + routes |
| `phase8Migrate.js` | Link `CsOnboardingRecord` ? Project or UNKNOWN |
| `catalogue.js` / `index.js` | wave: 4; Wave 4 exports |

### Foundations

- `lib/admin/customerSuccess/foundations.js` � when `onboardingProjectId` present, project Project status (`projectedFromProject: true`); never invent COMPLETED

### Prisma / SQL

- `CsOnboardingRecord.onboardingProjectId` + `migrationStatus`
- `CustomerOnboardingProject.csOwnerAdminId` + `ownerAdminId`
- SQL fallback: `scripts/sql/cs-onboarding-phase17-wave4.sql`

### UI

- Overview, My Work, Team, Calendar, Queues, Requests (+ detail), Projects (+ tabs), Templates, Reports
- `components/admin/customerSuccess/OnboardingContextBar.js`

### i18n

- `locales/en/admin-pages.json` + `locales/ny/admin-pages.json` ? `customerSuccess.onboardingHub.*`

### Docs (Phase 18 pack)

- `PHASE_18_INPUTS.md`
- `PHASE_18_READINESS_CHECKLIST.md`
- `FINAL_PHASE_17_REPORT.md`
- `FINAL_READINESS_DECISION.md` ? **`READY_FOR_PHASE_18_WITH_BLOCKERS`**

## Constraints honored

- [x] In-place; **no git commit**
- [x] Portfolio / My Work excludes other owners' projects
- [x] No credentials in exports/search; no migration file contents in search
- [x] No Tenant GL; no fabricate completion; certificate idempotent
- [x] Gate fail ? never false zero
- [x] Phase 8 link or UNKNOWN � never invent COMPLETED
- [x] Optional gaps explicit (portal, Training engine, migration engine, providers)

## Exit readiness

**`READY_FOR_PHASE_18_WITH_BLOCKERS`**

Blockers carried: Customer portal `NOT_CONFIGURED`; Training execution (Phase 18); migration engine `NOT_AVAILABLE`; MRA fiscal boundary; payment/e-sign providers (Phase 16 carry).

## Concerns

- Thin UI hubs only (no live client-side card fetch wired); counts/services are server-side ready for API wiring.
- Prisma `db push` / `generate` may still hit Windows EPERM � use SQL fallback.
- My Work owner pins (`csOwnerAdminId` / `ownerAdminId`) need to be set on Project create/assign in ops; Wave 1 create still primarily uses `ownerAssignmentsJson`.

## Fix wave

Addressed Important review findings (no git commit):

1. **Owner pins on create** � `createOnboardingProject` now persists `csOwnerAdminId` / `ownerAdminId` from `ownerAssignments` (implementation-owner aliases + actor fallback) alongside `ownerAssignmentsJson`, so My Work OR filters match real Wave 1 projects.
2. **Search fail-closed** � `searchOnboardingIndex` no longer fail-opens to all tenants when `portfolioTenantIds` is omitted/empty for scoped CS actors; resolves actor portfolio via `resolveCsPortfolioScope`; Super Admin may see all only when portfolio mode is `all`.
3. **Broken Phase 8 link** � `foundations.serializeRow` surfaces `UNKNOWN` / `linkBroken` when `onboardingProjectId` is set but Project cannot be resolved; never falls back to legacy `COMPLETED`.

Tests: Wave 1 create pin assertions; Wave 4 search omit/empty scope + JSON-only My Work negative + broken-link foundations.
