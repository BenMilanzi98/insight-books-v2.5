# Current Implementation Audit — MRA EIS Payment Plans

**Date:** 2026-07-28  
**Repo:** InsightBooks V2

## Executive verdict

Three parallel control planes exist today and are only loosely connected:

| Plane | Source of truth | Status |
|-------|-----------------|--------|
| A. Platform SaaS billing | `PlatformPlanVersion`, `PlatformInvoice`, `PlatformPayment`, credits/refunds | **INCOMPLETE** (schema + admin APIs; migrations/FKs/PayChangu wiring weak) |
| B. Legacy subscriptions | `AccountSubscription` + `lib/subscriptionConfig.js` + PayChangu | **KEEP / REFACTOR** — includes `eis-monthly` / `eis-yearly` |
| C. MRA EIS compliance | `MraEisTenantEntitlement` + ops stack under `lib/mraEis/*` | **KEEP** — **DISCONNECTED** from billing |

There is **no** dedicated `EisSubscription` Prisma model. EIS commercial access is an `AccountSubscription` whose `plan` is an EIS plan code.

## What exists (KEEP / REUSE)

- Versioned platform plans API (`/api/admin/platform-billing/plans`) with price-change → new version rule
- Platform invoice/payment/credit/refund helpers with SHA idempotency keys (`lib/admin/platformBilling.js`)
- Hardcoded catalog including EIS plans (`lib/subscriptionConfig.js`)
- Admin billing UI under `/insightbooks/billing/**`
- Admin EIS subscription API (`/api/admin/eis-subscriptions`) — UI currently **hidden** (`SHOW_EIS_SUBSCRIPTION_UI = false`)
- Full MRA EIS entitlement + terminals + mappings + transmission stack
- Tenant ops UI under `/settings/integrations/mra-eis/**`
- Tenant core checkout at `/subscription` via PayChangu

## What does not exist (GAP)

- Admin-configurable MRA EIS plan category with public visibility controls
- Public `/mra-eis` or `/mra-eis/pricing` marketing routes
- Database-driven public pricing (landing uses `PUBLIC_SUBSCRIPTION_PLANS`, EIS excluded)
- Tenant self-serve EIS plan purchase / compare / change-plan
- Canonical pricing service shared by landing, checkout, invoice, renewal
- Proration, structured upgrade/downgrade, billing-cycle change engine
- Usage metering that excludes retries/reprints from overage
- Subscription ↔ entitlement sync (payment → entitlement request; cancel → policy)
- Dedicated MRA EIS subscription aggregate with scope + state machine as specified
- Migrations guaranteeing all `Platform*` tables in every environment
- Server-side rejection of client-supplied PayChangu amounts

## Critical risks (summary)

1. **ENTITLEMENT_RISK:** Paid EIS plan ≠ entitlement; entitlement ≠ paid plan  
2. **DUPLICATE_SUBSCRIPTION_RISK:** PayChangu “deactivate all actives” can cancel coexisting standard + EIS rows  
3. **DUPLICATE_BILLING_RISK:** PayChangu does not write `PlatformPayment`; dual ledgers drift  
4. **UNSAFE:** Create-session trusts browser `amount`; some admin subscription routes lack granular billing permissions  
5. **INCOMPLETE:** Capability `futureRuntime` stub can block transmit even when ops ready  

## Recommended program shape

**Extend** `PlatformPlanVersion` with `planCategory = MRA_EIS` (and related JSON for features/limits/display), keep `AccountSubscription` (or a thin MRA EIS subscription wrapper) as commercial record, wire entitlement workflow explicitly, unify public/tenant pricing on a server pricing service — **do not** start with landing-page cards alone.
