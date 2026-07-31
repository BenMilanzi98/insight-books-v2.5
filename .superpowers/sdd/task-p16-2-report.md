# Task P16-2 Report — Wave 2 Customer/Tenant/Business/Branch/invitations

**Status:** COMPLETE  
**Date:** 2026-07-31  
**Commits:** none (per brief)

## TDD

### RED

```text
npx vitest run test/systemAdmin.crm.conversionWave2.test.js
→ Test Files 1 failed · Tests 7 failed (7)
→ TypeError: matchPlatformCustomer / createOrLinkTenant /
  createInitialUserInvitation / assertNoTenantAccountingSideEffects /
  assertTenantIsolation is not a function
→ orchestrator: customerCreated || customerLinked expected true, got undefined
```

### GREEN

```text
npx vitest run test/systemAdmin.crm.conversionWave2.test.js test/systemAdmin.crm.conversionWave1.test.js
→ Test Files 2 passed · Tests 18 passed (18)
```

## Delivered

| Area | Path |
|------|------|
| Match engine | `lib/admin/crm/conversions/customerMatch.js` |
| Customer provision | `lib/admin/crm/conversions/customerProvision.js` |
| Tenant provision | `lib/admin/crm/conversions/tenantProvision.js` |
| Business/Branch + contact link | `lib/admin/crm/conversions/businessBranch.js` |
| Invitations (hash-only) | `lib/admin/crm/conversions/invitations.js` |
| Isolation | `lib/admin/crm/conversions/isolation.js` |
| Accounting boundary | `lib/admin/crm/conversions/accountingBoundary.js` |
| Wave 2 runner | `lib/admin/crm/conversions/wave2Runner.js` |
| Orchestrator wire | `lib/admin/crm/conversions/orchestrator.js` + `steps.js` `ensureWave2Steps` |
| Catalogue | Wave 2 steps, match states, reserved slugs, domain wave=2 |
| SQL | `scripts/sql/crm-conversion-phase16-wave2.sql` |
| Prisma | `PlatformCustomer`, `CrmConversionMatchDecision`, `CrmConversionResource`, `CrmConversionInvitation` |
| Thin API/UI | `app/api/admin/crm/conversions/duplicate-review/route.js`, `app/insightbooks/crm/conversions/duplicate-review/page.js` |
| Tests | `test/systemAdmin.crm.conversionWave2.test.js` |

## Acceptance coverage

- [x] Vitest Wave 2 PASS (POSSIBLE_MATCH blocks create; exact link no duplicate; reserved/unique slug; invite exact retry hash-only; accounting boundary; cross-tenant Business denied; orchestrator runs Wave 2 after Closed Won)
- [x] Match/create-link decisions audited (`CrmConversionMatchDecision`)
- [x] Isolation + invitation security (hash only; no raw token/password)
- [x] No Subscription/Invoice; Tenant status `PROVISIONING` (not ACTIVE); no git commit
- [x] Wave 1 suite still green (18 total)

## Self-review

- POSSIBLE_MATCH / CONFLICT never auto-merge; create blocked + review flag.
- Tenant create wraps carefully with conversion-resource idempotency; does not use admin tenants POST (`status: active` + trial sub).
- Invitation persists `tokenHash` only; exact idempotencyKey retry returns same invite.
- `assertNoTenantAccountingSideEffects` rejects journal/balance rows; CoA init is best-effort and must not post journals.
- Missing/partial models return typed `NOT_AVAILABLE` / `COMPLETED_WITH_WARNING` without fabricating ACTIVE.
- First-class Business model absent → ConversionResource + optional `conversionBusiness` proxy; Branch uses real `Branch` model.
- Wave 2 reactivates Wave 1 `SKIPPED_NOT_APPLICABLE` provision steps via `ensureWave2Steps`.

## Concerns

1. `PlatformCustomer` is a new conversion identity table — reconcile with Tenant/CustomerPortfolio CS plane before production cutover.
2. Prisma generate/db push may still hit Windows EPERM — apply `scripts/sql/crm-conversion-phase16-wave2.sql` as fallback.
3. CoA/role seed on Tenant create is best-effort; unit mocks without payment/CoA models log non-fatal warnings when enabled.
4. Wave 3 must not treat Wave 2 `PARTIALLY_COMPLETED` as subscription/billing complete.

## Report path

`.superpowers/sdd/task-p16-2-report.md`

## Fix wave (Important)

**Date:** 2026-07-31  
**Review:** `task-p16-2-review.md` Important #1–#3  
**Commits:** none (per brief)

### Fixes

1. **Fail-closed Customer/Tenant exceptions** (`wave2Runner.js`)  
   Catch blocks now mark `FAILED_RETRYABLE` + `blocked: true` (not `COMPLETED_WITH_WARNING`). Customer exception prevents Tenant create; Tenant exception does not soft-continue dependents.

2. **Honest Business NOT_AVAILABLE** (`businessBranch.js`)  
   Missing `conversionBusiness` returns `{ ok: false, status: 'NOT_AVAILABLE', skippedBusiness: true }` — no `biz-proxy:*` fabrication; `businessCreated` stays false.

3. **Accounting-boundary orphan compensation** (`tenantProvision.js`)  
   Post-create boundary failure marks tenant `FAILED_PROVISIONING`, writes ConversionResource `FAILED_PROVISIONING`, and exact retry resumes the same tenant (no slug-collision orphan). Wave 2 maps boundary/FAILED to `FAILED_RETRYABLE`.

### Vitest (re-run)

```text
npx vitest run test/systemAdmin.crm.conversionWave2.test.js
→ Test Files 1 passed (1)
→ Tests 10 passed (10)
```

Added cases:
- Customer step exception fails closed (no Tenant without Customer)
- Missing Business model → typed NOT_AVAILABLE (no biz-proxy)
- Accounting-boundary fail after Tenant create is compensatable and retry-idempotent
