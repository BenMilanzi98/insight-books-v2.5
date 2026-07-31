### Task 3: Wave 3 — Subscription, entitlements, billing, payment boundary, activation

**Depends on:** Task 2 (Customer/Tenant provisioned or linked).

**Do NOT git commit.**  
**Do NOT implement:** CS/onboarding/training handoffs, weighted UI, full reports (Wave 4).

## Goal

Saga steps for Subscription create/amend, entitlement provision (qty ≤ accepted; Phase 9 taxonomy), Platform Billing Account/Schedule, first Platform Invoice (idempotent, from accepted snapshot), payment initiation boundary (existing provider or NOT_CONFIGURED; never fabricate PAID), activation policy service. Closed Won ≠ ACTIVE. Vitest green.

## Files

Create under `lib/admin/crm/conversions/`:
- `subscription.js`, `entitlements.js`, `billing.js`, `paymentBoundary.js`, `activation.js`
- Wire into orchestrator after Wave 2 steps
- `scripts/sql/crm-conversion-phase16-wave3.sql` + Prisma as needed
- Test: `test/systemAdmin.crm.conversionWave3.test.js`

## Interfaces

```js
createOrAmendSubscriptionFromAccepted(...)
provisionEntitlementsFromAccepted(...) // reject qty > accepted; no hidden features
createOrLinkBillingAccount / createBillingSchedule / createPlatformInvoiceIfRequired // Invoice idempotent
initiatePaymentIfRequired(...) // provider or NOT_CONFIGURED; initiation ≠ PAID
activateProvisionedSubscription({ actorContext, subscriptionId, activationPolicyVersionId, evidence, idempotencyKey })
```

## TDD

- Entitlement qty > accepted rejected
- Invoice exact retry → same invoice
- Payment initiation ≠ PAID
- Activation blocked without payment when policy requires
- Expansion path no duplicate Tenant
- Platform Invoice creates no Tenant GL

## Hard rules

- Invoice from accepted pricing snapshot only (not live Price Book)
- No fabricate PAID/ACTIVE
- Reuse existing subscription/billing services or typed NOT_AVAILABLE
- No commit

## Acceptance

- [ ] Vitest Wave 3 PASS
- [ ] Subscription pending until activation policy
- [ ] Invoice idempotent; payment honesty
- [ ] No Tenant GL; no commit

## Report

`.superpowers/sdd/task-p16-3-report.md` with RED/GREEN. Return status + test summary + concerns + path.
