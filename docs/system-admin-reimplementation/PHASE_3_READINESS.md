# Phase 3 Readiness — Platform Billing Centre

**Status:** **Production-ready for Phase 3 scope** (2026-07-27)

## Delivered

| Area | Delivery |
|------|----------|
| Platform ledger models | `PlatformInvoice`, `PlatformPayment`, `PlatformPlanVersion`, `PlatformCredit`, `PlatformRefund` |
| Separation from tenant AR | `/api/admin/invoices` now returns **platform** invoices only (deprecated alias); tenant AR not exposed |
| Idempotent invoices/payments | Idempotency keys + unique constraints; callback/retry safe |
| Plan versioning | Price changes create `PlatformPlanVersion`; prior ACTIVE superseded |
| Renewals | `/api/admin/platform-billing/renewals` — one invoice per subscription period |
| Credits & refunds | APIs + Credits & Refunds UI; refund capped by paid amount |
| Overview | Real metrics from platform tables — **no fake hardcoded revenue** |
| Reconciliation | Line math + outstanding checks UI |
| Nav | Plans, Credits & Refunds, Reconciliation under Billing |

## Tests

```bash
npx vitest run test/systemAdmin.phase3.billing.test.js test/systemAdmin.platformBilling.test.js
```

## Exit criteria met

1. Platform billing separated from tenant AR.  
2. Stub billing overview/index replaced with real data / redirect.  
3. Plan versioning enforced for price changes.  
4. Renewal invoices idempotent per period.  
5. Credits/refunds idempotent and audited.  
6. Reconciliation surface available.  

## Ops

Stop `npm run dev` then run `npx prisma generate` after `db push` so the Prisma client includes the new models.
