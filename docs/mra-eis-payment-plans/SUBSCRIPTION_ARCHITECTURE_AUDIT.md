# Subscription Architecture Audit

**Date:** 2026-07-28

## Models

| Model | Classification | Notes |
|-------|----------------|-------|
| `AccountSubscription` | KEEP / EXTEND | Canonical SaaS sub; EIS = plan codes `eis-monthly` / `eis-yearly` |
| `BranchSubscription` | DUPLICATED | Parallel branch billing |
| `EisSubscription` | NOT_APPLICABLE | Does not exist |
| `Tenant.subscriptionPlan` | DUPLICATED | Denormalized; can drift |
| `MraEisTenantEntitlement` | DISCONNECTED | Compliance, not commercial |

## Catalog

| Artifact | Classification |
|----------|----------------|
| `lib/subscriptionConfig.js` (`SUBSCRIPTION_PLANS`, `EIS_PLAN_IDS`, `isEISPlan`) | KEEP / EXTEND — seed + legacy until DB owns catalog |
| `PUBLIC_SUBSCRIPTION_PLANS` | KEEP — **excludes EIS by design today** |

## Services

| File | Classification |
|------|----------------|
| `lib/subscriptionService.js` (`hasEISAccess`, `canSubmitEISInvoice`, trials) | REUSE / EXTEND |
| `lib/branchSubscriptionService.js` | DUPLICATED |
| Admin `subscriptions` / `eis-subscriptions` APIs | REUSE / UNSAFE (weak permission checks) |

## Trial

| Item | Classification |
|------|----------------|
| Core 2-day trial | KEEP |
| EIS on trial (`hasEISAccess` requires `isTrial: false`) | INCOMPLETE — no EIS trial SKU |
| Auto-init trial in access check | REFACTOR |

## Upgrade / downgrade / proration

| Capability | Classification |
|------------|----------------|
| Mid-cycle proration | NOT_APPLICABLE / INCOMPLETE — not implemented |
| `upgradeTenantSubscription` | INCOMPLETE — trial→paid; no proration |
| PayChangu deactivate-all-actives | DUPLICATE_SUBSCRIPTION_RISK — can kill coexisting EIS/core |

## Priority fixes for this program

1. Model **product coexistence** (core + EIS) so activation does not cancel the other  
2. Add MRA EIS plan category on platform plans; keep AccountSubscription (or wrapper) as commercial record  
3. Harden admin EIS APIs with `systemAdmin.billing.*` / dedicated mraSubscriptions perms  
4. Optional: dedicated `MraEisSubscription` table if AccountSubscription cannot safely carry scope/state machine — decision pending  
