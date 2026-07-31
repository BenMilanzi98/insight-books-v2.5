# Task P16-3 Report — Wave 3 Subscription / entitlements / billing / payment / activation

**Status:** COMPLETE  
**Date:** 2026-07-31  
**Commits:** none (per brief)

## TDD

### RED

```text
npx vitest run test/systemAdmin.crm.conversionWave3.test.js
→ Test Files 1 failed · Tests 8 failed (8)
→ TypeError: provisionEntitlementsFromAccepted / createPlatformInvoiceIfRequired /
  createOrAmendSubscriptionFromAccepted / createOrLinkBillingAccount is not a function
→ CRM_ACTIVATION_POLICY.AFTER_PAYMENT undefined
```

### GREEN

```text
npx vitest run test/systemAdmin.crm.conversionWave3.test.js
→ Test Files 1 passed (1)
→ Tests 8 passed (8)

npx vitest run test/systemAdmin.crm.conversionWave1.test.js \
  test/systemAdmin.crm.conversionWave2.test.js \
  test/systemAdmin.crm.conversionWave3.test.js
→ Test Files 3 passed (3)
→ Tests 29 passed (29)
```

## Delivered

| Area | Path |
|------|------|
| Subscription | `lib/admin/crm/conversions/subscription.js` |
| Entitlements | `lib/admin/crm/conversions/entitlements.js` |
| Billing | `lib/admin/crm/conversions/billing.js` |
| Payment boundary | `lib/admin/crm/conversions/paymentBoundary.js` |
| Activation | `lib/admin/crm/conversions/activation.js` |
| Wave 3 runner | `lib/admin/crm/conversions/wave3Runner.js` |
| Orchestrator wire | `orchestrator.js` + `steps.js` `ensureWave3Steps` + catalogue Wave 3 |
| SQL | `scripts/sql/crm-conversion-phase16-wave3.sql` |
| Prisma | `PlatformBillingAccount`, `PlatformBillingSchedule`, `CrmConversionActivationAttempt` |
| Tests | `test/systemAdmin.crm.conversionWave3.test.js` |

## Acceptance coverage

- [x] Vitest Wave 3 PASS (entitlement qty > accepted rejected; invoice exact retry same id; payment initiation ≠ PAID / NOT_CONFIGURED; activation blocked without payment under AFTER_PAYMENT; expansion amends without duplicate Tenant; Platform Invoice → no Tenant GL)
- [x] Subscription pending until activation policy (`PENDING_ACTIVATION`, `isActive: false`)
- [x] Invoice idempotent from accepted snapshot; payment honesty (never fabricate PAID)
- [x] No Tenant GL; no git commit
- [x] Wave 1–2 suites still green (29 total)

## Self-review

- Invoice amounts/source bind to `acceptedSnapshot` only (`source: 'ACCEPTED_SNAPSHOT'`); live Price Book unused.
- Payment initiation returns `NOT_CONFIGURED` when no provider — does not invent PAID/COMPLETED rows.
- `activateProvisionedSubscription` blocks AFTER_PAYMENT without `paymentSuccessful`; Closed Won evidence alone insufficient.
- Entitlement qty > accepted → `entitlement_qty_exceeds_accepted`; features absent from snapshot → `hidden_entitlement_forbidden`.
- Expansion `AMEND` updates existing subscription; tenant count unchanged.
- Missing billing/subscription models return typed `NOT_AVAILABLE` / skip — never fabricate ACTIVE.
- Plans without `acceptedSnapshot` skip Wave 3 steps (`SKIPPED_NOT_APPLICABLE`) so Wave 1–2 regressions stay honest.

## Concerns

1. `PlatformBillingAccount` / `PlatformBillingSchedule` are new conversion-plane tables — apply SQL or `prisma db push` before production; Windows EPERM may still require SQL fallback.
2. `AccountSubscription.status` uses `PENDING_ACTIVATION` alongside legacy `"Pending"` — UI/reporting may need to treat both as non-active.
3. Payment provider remains env/`plan.paymentProvider` optional; Phase 17 may wire a real gateway callback → PAID → re-activation.
4. Wave 3 activation under AFTER_PAYMENT completes step as `COMPLETED_WITH_WARNING` (deferred) — conversion stays `PARTIALLY_COMPLETED` until payment truth arrives (Wave 4/ops).

## Fix wave (Important)

**Date:** 2026-07-31  
**Commits:** none (per instructions)

### Fixes

1. **Poisoned activation idempotency** — `activateProvisionedSubscription` short-circuits exact `idempotencyKey` only when a prior attempt `activated === true`. Blocked/deferred rows stay re-evaluable; success supersedes via update. Wave 3 ACTIVATE deferred outcome is `FAILED_RETRYABLE` (not `COMPLETED_WITH_WARNING`) so the spine can re-enter after payment truth.
2. **AFTER_PAYMENT payment truth** — Caller `paymentSuccessful` / `paymentCompleted` booleans are ignored. `resolveAuthoritativePaymentSuccess` requires a successful `PlatformPayment` (by `paymentId` or `invoiceId`); fail closed otherwise. `paymentVerified` is set only after that lookup.
3. **Missing `subscriptionId`** — `PROVISION_ENTITLEMENTS` / `ACTIVATE_SUBSCRIPTION` complete as `FAILED_RETRYABLE` with `subscriptionId_required` instead of sticking `IN_PROGRESS`.
4. **Entitlement activation scope** — Promotes only conversion-scoped entitlement ids (`args.entitlementIds` or `ENTITLEMENT_SET` resource meta); never all tenant `PENDING` rows.

### Vitest

```text
npx vitest run test/systemAdmin.crm.conversionWave3.test.js
→ Test Files 1 passed (1)
→ Tests 12 passed (12)
```

New cases: blocked-key re-eval after payment; boolean forgery rejected; conversion-scoped entitlement promote; missing-subscriptionId no sticky `IN_PROGRESS`.

## Report path

`.superpowers/sdd/task-p16-3-report.md`
