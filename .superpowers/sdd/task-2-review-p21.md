# Task 2 Review — Phase 21 Wave 2 Readiness honesty + accounting boundary

**Reviewer:** SDD review subagent  
**Date:** 2026-07-31  
**Mode:** READ-ONLY (this review file only)  
**Scope (LIVE):** `lib/admin/customerSuccess/onboarding/readiness/{provisioning,subscription,entitlement,users,configuration,integration,evaluate}.js`; `accountingBoundary.js`; `migration.js`; `projectAccess.js`; `test/systemAdmin.cs.onboardingPhase21Wave2.test.js`  
**Vitest (LIVE):** `npx vitest run test/systemAdmin.cs.onboardingPhase21Wave2.test.js test/systemAdmin.cs.onboardingPhase21Wave1.test.js` → **19/19 PASS** (Wave2 9/9 + Wave1 10/10)

## Focus checklist (LIVE)

| Focus | Result |
|-------|--------|
| Request ≠ ACTIVE/PROVISIONED | **PASS** — PENDING statuses → NOT_READY; TERMINAL without `providerResult.ok` → NOT_READY (`fabricated_terminal_without_provider_result`); READY only with provider confirm |
| Invitation ≠ ACCESS_VALID | **PASS** — INVITED/SENT → NOT_READY (`invitation_sent_not_access_valid`); READY only with accessValid / ACCESS_VALID / non-invite ACTIVE |
| No fabricated IDs | **PASS** — `assertNoFabricatedTenantIdentity` + `refuseOnboardingTenantMint` / `refuseOnboardingUserMint`; no `tenant.create`/`user.create` mint paths in onboarding |
| Migration coordinate only | **PASS** — `setMigrationCoordinationStatus` + recon gate; `runOnboardingBrowserImport` / `assertMigrationCoordinationOnly` refuse browser/import engine |
| Accounting boundary | **PASS** — `assertGovernedAccountingOnly` allowlists governed actions; BALANCE_EDIT / FAKE_JOURNAL / SYSTEM_COA_ADMIN + create/edit/CoA refuse helpers |
| Portfolio fail-closed | **PASS** — `loadOnboardingProjectForActor` on migration + readiness eval persist; empty/`tenant-other` scope denies writes-by-id |

## Issues

### Critical

None.

### Important

None.

### Minor

1. **G21-08 test leaves `forgedActive` unasserted** — `ignoreAuthoritative: true` path is exercised but not `expect`ed; LIVE returns UNKNOWN correctly — tighten assertion only.
2. **Portfolio blank-`tenantId` skip** — same Wave 1 note: scoped deny requires truthy `project.tenantId`; blank tid falls through scope membership check (defense-in-depth).
3. **G21-13/14 partial per plan** — report acknowledges; browser-import refuse + secret redact land; deeper engine/integration work remains Wave 2–3.

## Assessment

**Approved with notes**

All LIVE focus checks pass; Waves 1–2 Vitest green. No Critical/Important defects. Residual items are Minor / planned partials. SDD review gate clear for Wave 3.
