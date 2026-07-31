# Task 2 Report — Phase 20 Wave 2 (saga idempotency / snapshot / duplicates)

**Date:** 2026-07-31  
**Status:** COMPLETE (GREEN)  
**Commit:** none (WORKING_TREE only, per brief)

---

## Summary

Hardened conversion saga idempotency, commercial snapshot immutability, Customer EXACT_MATCH / LINK_EXISTING gates, Contact duplicate link-vs-create with consent + cross-Customer deny, and optimistic step claim so resume cannot duplicate downstream creates. Existing `CrmConversion*` spine extended — no `SalesConversion*` domain.

---

## RED

```text
npx vitest run test/systemAdmin.crm.conversionPhase20Wave2.test.js

 FAIL  (suite import)
- Cannot find package …/commercialSnapshot.js
- missing EXACT_MATCH / LINK_EXISTING / claimConversionStep / decideContactCreateOrLink
```

Failure mode: Wave 2 APIs absent (expected before harden).

---

## GREEN

```text
npx vitest run test/systemAdmin.crm.conversionPhase20Wave1.test.js test/systemAdmin.crm.conversionPhase20Wave2.test.js test/systemAdmin.crm.conversionWave2.test.js

 Test Files  3 passed (3)
      Tests  30 passed (30)
```

| Case | Result |
|------|--------|
| Catalogue EXACT_MATCH / LINK_EXISTING / CREATE_NEW / COMMERCIAL_SNAPSHOT | PASS |
| Exact CVN retry same id; conflicting idempotency fails | PASS |
| Snapshot lock + checksum; Proposal draft edit ≠ mutate locked snapshot | PASS |
| EXACT_MATCH blocks auto-create; LINK_EXISTING; no auto-merge; provision forge gate | PASS |
| Contact link vs create; consent preserved; cross-Customer denied | PASS |
| Optimistic step claim + resume without duplicate Customer create | PASS |

---

## Deliverables

| Area | Path |
|------|------|
| Snapshot lock | `lib/admin/crm/conversions/commercialSnapshot.js` |
| Match / decisions | `lib/admin/crm/conversions/customerMatch.js`, `catalogue.js` |
| Provision gate | `lib/admin/crm/conversions/customerProvision.js` |
| Contact duplicates | `lib/admin/crm/conversions/businessBranch.js` (`decideContactCreateOrLink`) |
| Optimistic steps | `lib/admin/crm/conversions/steps.js` (`claimConversionStep`, `beginStepOptimistic`) |
| Spine wiring | `wave2Runner.js`, `wave3Runner.js`, `conversions/index.js`, `crm/index.js` |
| Test | `test/systemAdmin.crm.conversionPhase20Wave2.test.js` |
| Gap register | `docs/admin-intelligence-crm/phase-20/PHASE_20_GAP_REGISTER.md` (G20-07…11 CLOSED) |

### Interfaces hardened

- `CRM_CUSTOMER_MATCH_STATE.EXACT_MATCH` / `LINK_EXISTING` / `CREATE_NEW`
- `CRM_CONVERSION_RESOURCE_TYPE.COMMERCIAL_SNAPSHOT`
- `CRM_CONTACT_LINK_DECISION` (LINK / CREATE / DENIED_CROSS_CUSTOMER)
- `lockConversionCommercialSnapshot` / `getLockedConversionCommercialSnapshot` / `resolveConversionAcceptedSnapshot`
- `decideCustomerCreateOrLink` → LINK_EXISTING / CREATE_NEW; EXACT_MATCH blocks CREATE
- `createOrLinkPlatformCustomer` server gate refuses forged CREATE on EXACT_MATCH
- `decideContactCreateOrLink` + `linkContactsForConversion` consent preserve / cross-Customer deny
- `claimConversionStep` / `beginStepOptimistic` CAS on status+attemptCount
- Wave 2 locks snapshot at provision; Wave 3 prefers locked snapshot

---

## Gap register (Wave 2 Critical/High)

| ID | Status |
|----|--------|
| G20-07 | CLOSED (Wave 1+2) |
| G20-08 | CLOSED |
| G20-09 | CLOSED |
| G20-10 | CLOSED |
| G20-11 | CLOSED |

---

## Notes / follow-ups

- SDD review gate before Wave 3.
- Compat: Phase 16 Wave 2 test accepts EXACT_MATCH alias; orchestrator test spies readiness (Wave 1 acceptance honesty).
- No Prisma schema migration required — snapshot lock uses `CrmConversionResource`.

---

## Fix wave

**Date:** 2026-07-31  
**Source:** `.superpowers/sdd/task-2-review-p20.md` Critical #1–2 + Important #1  
**Commit:** none (WORKING_TREE only)

### Fixes

| Finding | Change |
|---------|--------|
| Critical #1 — EXACT_MATCH forge fallthrough | `customerProvision.js`: exact/high-confidence identity requires `LINK` only; any other decision fails closed (`invalid_customer_decision` / exact block). No fallthrough to `platformCustomer.create`. |
| Critical #2 — concurrent `alreadyInProgress` TOCTOU | `steps.js`: `IN_PROGRESS` → `skip: true` + `concurrencyConflict` (no re-enter create). Provision re-reads resource before CREATE; resource `P2002` → idempotent replay. |
| Important #1 — `concurrencyConflict` null customerId | `wave2Runner.js`: conflict path wait/re-reads `PLATFORM_CUSTOMER` resource or step output; otherwise `blocked: true` — never continue Wave 2 with `customerId = null`. |

### Tests added (Wave 2)

- EXACT_MATCH forged non-LINK (`LINK_REQUIRED` / `REVIEW` / etc.) never creates
- Concurrent `alreadyInProgress` resume does not double-create Customers
- `concurrencyConflict` blocks Wave 2 when customerId missing

### Vitest (re-run Wave 1 + Wave 2 + legacy Wave 2)

```text
npx vitest run test/systemAdmin.crm.conversionPhase20Wave1.test.js test/systemAdmin.crm.conversionPhase20Wave2.test.js test/systemAdmin.crm.conversionWave2.test.js

 Test Files  3 passed (3)
      Tests  33 passed (33)
```
