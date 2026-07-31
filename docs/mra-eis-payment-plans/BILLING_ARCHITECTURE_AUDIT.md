# Billing Architecture Audit

**Date:** 2026-07-28

## Platform models (`prisma/schema.prisma`)

| Model | Classification | Notes |
|-------|----------------|-------|
| `PlatformInvoice` | INCOMPLETE / EXTEND | Admin APIs exist; weak FKs; not written by PayChangu |
| `PlatformPayment` | INCOMPLETE / EXTEND | Unique `(gateway, gatewayReference)` good; unused by PayChangu |
| `PlatformPlanVersion` | REUSE / EXTEND | Versioning on price change; no `planCategory` / MRA fields |
| `PlatformCredit` | INCOMPLETE / REUSE | API exists; overpayment does not auto-credit |
| `PlatformRefund` | REUSE | Cap + idempotency |
| `PlatformFeatureEntitlement` | DISCONNECTED | Generic flags; not MRA EIS billing |

## Admin APIs (`app/api/admin/platform-billing/**`)

| Route | Classification |
|-------|----------------|
| overview | REFACTOR (status filter mismatch with AccountSubscription) |
| invoices | KEEP / REUSE |
| payments | EXTEND (manual; Date.now fallback idempotency UNSAFE) |
| renewals | EXTEND (bridges subscription → invoice; no payment collect) |
| plans | REUSE (seeds from `SUBSCRIPTION_PLANS` incl. EIS) |
| credits / refunds | REUSE |
| reconciliation | KEEP (math checks only) |

## Lib

| File | Classification |
|------|----------------|
| `lib/admin/platformBilling.js` | KEEP / REUSE — canonical helpers |
| Route-local orchestration | REFACTOR — extract services |

## Idempotency

| Pattern | Classification |
|---------|----------------|
| Invoice period SHA key | KEEP |
| Payment gateway+ref SHA | REUSE (once PayChangu writes ledger) |
| Manual payment `Date.now()` key | UNSAFE |
| PayChangu → AccountSubscription only | DISCONNECTED from Platform* |

## Gaps for MRA EIS plans

1. Migrations + FKs for Platform* in all envs  
2. `planCategory` / product code / featuresJson / limitsJson / public flags on plan versions  
3. PayChangu success → PlatformPayment + invoice allocation  
4. Server pricing service as single calculator  
5. Period uniqueness for EIS renewals and setup-fee lines  
