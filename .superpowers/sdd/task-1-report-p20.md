# Task 1 Report — Phase 20 Wave 1 (Closed-Won readiness / acceptance / authority / approvals)

**Date:** 2026-07-31  
**Status:** COMPLETE (GREEN)  
**Commit:** none (WORKING_TREE only, per brief)

---

## Summary

Hardened Closed-Won / conversion readiness so expired or superseded commercial versions, UNKNOWN / VERIFICATION_REQUIRED authority, missing acceptance (handoff pin alone), and unapproved material discounts cannot reach READY. View/open/silence cannot invent acceptance. `closeOpportunityWon` gates on commercial readiness when `acceptanceId` is supplied, remains non-provisioning, and fail-closes empty territory/team scopes. Exact CVR create + close retry edges covered.

---

## RED

```text
npx vitest run test/systemAdmin.crm.conversionPhase20Wave1.test.js

 FAIL  (9 failed)
- CRM_CONVERSION_READINESS_STATUS.UNKNOWN undefined
- CRM_ACCEPTANCE_AUTHORITY_STATUS undefined
- expired/superseded/authority/discount/soft-pass/scope gaps
```

Failure mode: missing UNKNOWN authority/readiness enums and soft-pass paths (expected before harden).

---

## GREEN

```text
npx vitest run test/systemAdmin.crm.conversionPhase20Wave1.test.js

 Test Files  1 passed (1)
      Tests  9 passed (9)
```

Regression: `conversionWave1` + `commercialWave4` — 27 passed.

| Case | Result |
|------|--------|
| UNKNOWN readiness status exists; UNKNOWN ≠ READY | PASS |
| Expired commercial version blocks READY | PASS |
| Superseded proposal version blocks READY | PASS |
| View/open/silence ≠ acceptance | PASS |
| Authority UNKNOWN / VERIFICATION_REQUIRED blocks | PASS |
| Unapproved material discount blocks | PASS |
| Handoff pin without acceptance ≠ READY | PASS |
| Exact close + CVR retry; close alone no provision | PASS |
| Empty territory scope fail-closes Closed-Won | PASS |

---

## Deliverables

| Area | Path |
|------|------|
| Conversion readiness | `lib/admin/crm/conversions/readiness.js`, `catalogue.js` |
| Commercial readiness | `lib/admin/crm/commercial/readiness.js` |
| Acceptance / authority | `lib/admin/crm/commercial/acceptance.js` |
| Close + scope | `lib/admin/crm/opportunities/close.js`, `lib/admin/crm/authz.js` |
| Exports | `lib/admin/crm/commercial/index.js`, `lib/admin/crm/index.js` |
| Test | `test/systemAdmin.crm.conversionPhase20Wave1.test.js` |
| Gap register | `docs/admin-intelligence-crm/phase-20/PHASE_20_GAP_REGISTER.md` (G20-01…07 CLOSED) |

### Interfaces hardened

- `CRM_CONVERSION_READINESS_STATUS.UNKNOWN` (+ APPROVAL_REQUIRED / READY_WITH_WARNINGS / DUPLICATE_REVIEW_REQUIRED)
- `CRM_READINESS_STATUS.UNKNOWN` (+ APPROVAL_REQUIRED / …)
- `CRM_ACCEPTANCE_AUTHORITY_STATUS` = VERIFIED \| VERIFICATION_REQUIRED \| UNKNOWN
- `evaluateAcceptanceAuthorityStatus` — role string alone ≠ VERIFIED
- `assertEngagementIsNotAcceptance` — view/open/silence never acceptance
- `acceptCommercialDocument` rejects `inferFromView` / `silenceAsAcceptance`; stamps `authorityStatus: VERIFIED`
- `evaluateClosedWonReadiness` — expired/superseded/authority/discount blockers
- `evaluateConversionRequestReadiness` — no soft-pass; UNKNOWN ≠ READY (`ok` only READY / READY_WITH_WARNINGS)
- `closeOpportunityWon` — readiness gate when `acceptanceId`; ALREADY_TERMINAL idempotent flags; no provision
- `resolveCrmScope` — empty territory/team/owner membership fail-closed

---

## Gap register (Wave 1 Critical/High)

| ID | Status |
|----|--------|
| G20-01 | CLOSED |
| G20-02 | CLOSED |
| G20-03 | CLOSED |
| G20-04 | CLOSED |
| G20-05 | CLOSED |
| G20-06 | CLOSED |
| G20-07 | CLOSED (Wave 1 edges; conflict deepen remains Wave 2) |

---

## Notes / follow-ups

- SDD review gate before Wave 2.
- G20-07 conflicting idempotency payload deepen deferred to Task 2.
- Compat fixture updates: `commercialWave4` acceptance `authorityStatus: VERIFIED`; `conversionWave1` seeds acceptance + version.

---

## Fix wave

**Date:** 2026-07-31  
**Trigger:** SDD review Critical + Important (`.superpowers/sdd/task-1-review-p20.md`)  
**Commit:** none (WORKING_TREE only)

### Fixed

| Severity | Item | Fix |
|----------|------|-----|
| Critical | `authorityStatus` not in Prisma | Added `CrmCommercialAcceptance.authorityStatus` (`@default("UNKNOWN")` + index); SQL fallback `scripts/sql/crm-commercial-phase20-wave1.sql`; model guards `hasCrmCommercialAcceptanceAuthorityStatusField` / `buildCommercialAcceptanceWriteData` / `serializeCommercialAcceptance`; accept path refuses unavailable column and persists `VERIFIED` |
| Important | Close readiness opt-in via `acceptanceId` only | `resolveClosedWonAcceptanceId` + `commercialReadinessRequiredByPolicy` — ACCEPTANCE evidence alone triggers commercial readiness gate |
| Important | REJECTED/CANCELLED discounts block READY | Policy: only PENDING / open required-unapproved material discounts block; REJECTED/CANCELLED do not |
| Important | SoD not re-validated at readiness | Readiness re-checks APPROVED discounts (`requestedByAdminId` ≠ `approvedByAdminId`); Closed-Won self-approval blocked when `requireApproval` + `approvalGranted` |
| Important | Discount `findMany` OR mock / bad query | Production query scopes by `documentVersionId` only (real column); Wave 1 mock implements real `OR` filtering |

### Tests

```text
npx vitest run test/systemAdmin.crm.conversionPhase20Wave1.test.js

 Test Files  1 passed (1)
      Tests  14 passed (14)
```

Extended cases: authorityStatus persist on accept; evidence-only close readiness gate; REJECTED/CANCELLED ≠ block + documentVersionId scope; discount SoD at readiness; Closed-Won approver SoD.
