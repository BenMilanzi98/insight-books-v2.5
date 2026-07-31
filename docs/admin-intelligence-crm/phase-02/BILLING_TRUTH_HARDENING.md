# Billing Truth Hardening

**Date:** 2026-07-28  
**Status:** Finalized

## Problem (Phase 1)

- `/api/admin/dashboard/stats` treated Tenant `Sale`/`Expense` as platform revenue/profit.
- MRR used stubbed plan counts + broken `getSubscriptionPlan(planId)` (key vs id).
- Platform billing overview undercounted actives by filtering `status in ['active','ACTIVE']` while PayChangu writes `Completed`.
- PayChangu activations wrote commercial subscriptions without guaranteed PlatformInvoice linkage.

## Changes

| Asset | Change |
|-------|--------|
| `lib/admin/saasBillingKpis.js` | Canonical SaaS KPI pack from `AccountSubscription` + `PlatformPayment` |
| `lib/subscriptionConfig.js` | `getSubscriptionPlan` resolves by plan **id** (`1year`) as well as key |
| `app/api/admin/platform-billing/overview` | Active counts use commercial where; expose `estimatedMrr`, paid/tenant distinct counts; prefer payment cash when invoices sparse |
| `app/api/admin/dashboard/stats` | `totalRevenue` / `monthlyRecurringRevenue` / financialMetrics from SaaS KPIs; Tenant Sale moved to `tenantActivity` |

## PayChangu → PlatformInvoice (live path)

On verified PayChangu success (`app/api/subscription/paychangu/callback`):

1. Activate `AccountSubscription` / `BranchSubscription` (unchanged)
2. `ensurePaychanguPlatformLedger` (`lib/admin/paychanguPlatformLedger.js`):
   - Idempotent **PlatformInvoice** (PAID) for subscription period
   - Idempotent **PlatformPayment** linked via `invoiceId`
   - Relinks orphan payments when invoice already exists
   - Safe on callback replay

Branch activations write the ledger when `tenantId` is present.

## Historical backfill (final)

Idempotent repair for paid rows that pre-date auto-ledger writes:

| Asset | Role |
|-------|------|
| `lib/admin/paychanguLedgerBackfill.js` | Plan + dry-run/execute; account + branch; orphan link; unmatched report |
| `GET/POST /api/admin/platform-billing/paychangu-backfill` | Dry-run plan; execute needs `billing.reconciliation` |
| `/insightbooks/billing/reconciliation` | Dry-run + confirm execute (max 50) + unmatched orphans table |
| `scripts/paychangu-ledger-backfill.mjs` | Ops CLI (`--execute --max=50 --limit=500`) |

### Action types

| Action | Meaning |
|--------|---------|
| `create_ledger` | Missing invoice (+ payment) |
| `link_orphan` | Invoice exists; payment has null `invoiceId` for same txRef |
| `create_payment` | Invoice exists; no PlatformPayment for txRef |

Unmatched orphan payments (no matching subscription) are **reported only** — never invent invoices.

### Ops

```bash
# Dry-run (default)
node scripts/paychangu-ledger-backfill.mjs

# Execute up to 50 repairs
node scripts/paychangu-ledger-backfill.mjs --execute --max=50 --limit=500
```

Safe to re-run; all writes go through `ensurePaychanguPlatformLedger`.

## Explicit non-claims

- Estimated MRR is approximate (yearly ÷ 12; CORE+EIS coexistence can double-count rows).
- Unmatched orphan payments require manual investigation (no subscription/period to attach).
- Tenant Sale aggregates are **not** removed from DB queries yet (perf follow-up) but are **not** exposed as SaaS revenue fields.

## Tests

- `test/systemAdmin.saasBillingKpis.test.js`
- `test/systemAdmin.paychanguPlatformLedger.test.js`
- `test/systemAdmin.paychanguLedgerBackfill.test.js`
