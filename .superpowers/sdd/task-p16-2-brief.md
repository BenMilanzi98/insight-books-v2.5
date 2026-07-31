### Task 2: Wave 2 — Customer match/create-link, Tenant/Business/Branch, invitations

**Depends on:** Task 1 complete (orchestrator + Closed Won early).

**Do NOT git commit.**  
**Do NOT implement:** full Subscription/billing/activation (Wave 3) or CS/onboarding handoffs (Wave 4).

## Goal

Wire saga steps for Customer matching/create-or-link, Tenant create-or-link, primary Business/Branch, contact linking, initial User invitations — via existing services where present, typed UNAVAILABLE otherwise. Duplicate POSSIBLE_MATCH blocks create. Invitation hash-only + idempotent. Accounting init boundary (no journals). Vitest green.

## Files

Create under `lib/admin/crm/conversions/`:
- `customerMatch.js`, `customerProvision.js`, `tenantProvision.js`, `businessBranch.js`, `invitations.js`, `isolation.js`, `accountingBoundary.js`
- Extend orchestrator/steps to run these after Closed Won (not SKIPPED)
- `scripts/sql/crm-conversion-phase16-wave2.sql` + Prisma ConversionResource / match decision as needed
- Thin duplicate-review UI/API stubs OK
- Test: `test/systemAdmin.crm.conversionWave2.test.js`

## Interfaces

```js
matchPlatformCustomer(...) // EXACT | HIGH_CONFIDENCE | POSSIBLE | NO_MATCH | CONFLICT
decideCustomerCreateOrLink / decideTenantCreateOrLink // audited
// step handlers create/link via existing services OR { status: 'NOT_AVAILABLE' } without fabricating ACTIVE
createInitialUserInvitation // hash token; exact retry same invite
assertNoTenantAccountingSideEffects(...)
```

## TDD

- POSSIBLE_MATCH blocks Customer create
- Exact link → no duplicate Customer
- Tenant slug unique / reserved blocked
- Invitation exact retry no duplicate
- Accounting boundary: no journal/balance posts
- Cross-Tenant Business create denied

## Hard rules

- No auto-merge; no default passwords; no raw tokens stored
- Tenant not marked ACTIVE before activation policy (Wave 3) — use PROVISIONING / pending states
- Reuse existing services; no parallel Customer/Tenant domain
- No commit

## Acceptance

- [ ] Vitest Wave 2 PASS
- [ ] Match/create-link decisions audited
- [ ] Isolation + invitation security
- [ ] No Subscription/Invoice yet; no commit

## Report

`.superpowers/sdd/task-p16-2-report.md` with RED/GREEN. Return status + test summary + concerns + path.
