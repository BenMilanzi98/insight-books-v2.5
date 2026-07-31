# Task 3 Report — Phase 20 Wave 3 (request honesty + onboarding handoff)

**Date:** 2026-07-31  
**Status:** COMPLETE (GREEN)  
**Commit:** none (WORKING_TREE only, per brief)

---

## Summary

Hardened provision request≠result honesty (no ACTIVATED/PROVISIONED/PAID/ACTIVE without authoritative provider result) and onboarding handoff one-active lifecycle (checksum, pending provisioning labels, secret strip, correction supersession with history). Handoff remains record-only — never creates CS Onboarding Project; no GL/fiscal side effects. Partial provider failure surfaces PARTIALLY_COMPLETED/BLOCKED with idempotent resume.

---

## RED

```text
npx vitest run test/systemAdmin.crm.conversionPhase20Wave3.test.js

 FAIL  (5 tests)
- CRM_ONBOARDING_HANDOFF_PACKAGE_STATUS / honesty helpers undefined
- assertProvisionResultHonesty / sanitizeConversionHandoffPayload missing
- handoff checksum / one-active / supersession incomplete
- Wave 3 spine did not block on partial entitlement failure (mock CAS)
```

Failure mode: Wave 3 APIs absent / incomplete (expected before harden).

---

## GREEN

```text
npx vitest run \
  test/systemAdmin.crm.conversionPhase20Wave1.test.js \
  test/systemAdmin.crm.conversionPhase20Wave2.test.js \
  test/systemAdmin.crm.conversionPhase20Wave3.test.js \
  test/systemAdmin.crm.conversionWave3.test.js \
  test/systemAdmin.crm.conversionWave4.test.js

 Test Files  5 passed (5)
      Tests  48 passed (48)
```

| Case | Result |
|------|--------|
| Catalogue package statuses + honesty helpers | PASS |
| No fabricated ACTIVATED/PROVISIONED/PAID; forged forceActive ignored | PASS |
| AFTER_PAYMENT ignores caller paymentSuccessful booleans | PASS |
| Tenant create stays PROVISIONING (not PROVISIONED/ACTIVE) | PASS |
| Onboarding exact retry same; correction supersedes; one active | PASS |
| Pending provisioning labelled; checksum sha256; no Project create | PASS |
| Secrets stripped; Training/Migration/MRA no fiscal/credentials | PASS |
| Partial provider fail → blocked/partial; resume no duplicate subscription | PASS |

---

## Deliverables

| Area | Path |
|------|------|
| Request honesty | `lib/admin/crm/conversions/requestHonesty.js` |
| Handoff shared | `lib/admin/crm/conversions/handoffShared.js` (sanitize, checksum, one-active, send/supersede) |
| Onboarding package | `lib/admin/crm/conversions/onboardingHandoff.js` (`send` / `supersede`) |
| Provision strip | `subscription.js`, `entitlements.js`, `tenantProvision.js` |
| Spine status | `wave3Runner.js` (`conversionStatus: PARTIALLY_COMPLETED`) |
| Exports | `conversions/index.js`, `crm/index.js` |
| Test | `test/systemAdmin.crm.conversionPhase20Wave3.test.js` |
| Compat mocks | `test/systemAdmin.crm.conversionWave3.test.js` (step CAS + readiness spy) |
| Gap register | `docs/admin-intelligence-crm/phase-20/PHASE_20_GAP_REGISTER.md` (G20-12…15 CLOSED) |

### Interfaces hardened

- `assertProvisionResultHonesty` / `clampProvisionRequestStatus` / `stripFabricatedProvisionArgs`
- `CRM_ONBOARDING_HANDOFF_PACKAGE_STATUS` (READY / SENT / ACCEPTED_BY_ONBOARDING / …)
- `sanitizeConversionHandoffPayload` / `computeOnboardingHandoffChecksum`
- `createOnboardingHandoff` — one active; `correction` supersedes with history; pending labels; checksum
- `sendOnboardingHandoff` / `supersedeOnboardingHandoff` — never creates Onboarding Project
- Subscription / entitlement / tenant ignore `forceActive` / fabricated terminal statuses

---

## Gap register (Wave 3 Critical/High)

| ID | Status |
|----|--------|
| G20-12 | CLOSED |
| G20-13 | CLOSED |
| G20-14 | CLOSED |
| G20-15 | CLOSED (handoff strip; notes polish optional Wave 4) |

---

## Notes / follow-ups

- SDD review gate before Wave 4.
- Phase 16 Wave 3 mock gained `updateMany`/`findUnique` for Wave 2 CAS; orchestrator spies readiness (Wave 1 honesty).
- No Prisma schema migration — handoff status/history live on existing `CrmConversionDomainHandoff` string status + `payloadJson`.
- Does not create CS Onboarding Project (tree-17 / PRD-21).

---

## Fix wave

**Date:** 2026-07-31  
**Source:** `.superpowers/sdd/task-3-review-p20.md` Important #1–3  
**Commit:** none (WORKING_TREE only)

### Fixes

1. **Early Wave 3 blocked returns include `conversionStatus`** — `wave3BlockedResult()` on all mid-spine early exits + final return sets `CRM_CONVERSION_STATUS.PARTIALLY_COMPLETED`. Partial-fail test asserts `first.conversionStatus` directly (no invent-from-`blocked` tautology).
2. **Handoff sanitize denylist expanded** — substring match on `token` / `secret` plus explicit `accessToken`, `refreshToken`, `clientSecret`, `secretKey`, `authToken`, `bearerToken`, `sessionToken`; honesty flags preserved.
3. **Server-only `checksumSha256`** — always `computeOnboardingHandoffChecksum` from sanitized payload; caller mismatch → `checksum_mismatch` before supersession; matching/absent → persist computed value.

### Verification

```text
npx vitest run \
  test/systemAdmin.crm.conversionPhase20Wave1.test.js \
  test/systemAdmin.crm.conversionPhase20Wave2.test.js \
  test/systemAdmin.crm.conversionPhase20Wave3.test.js \
  test/systemAdmin.crm.conversionWave3.test.js \
  test/systemAdmin.crm.conversionWave4.test.js

 Test Files  5 passed (5)
      Tests  49 passed (49)
```
