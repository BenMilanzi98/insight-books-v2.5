# System Admin UI Audit

**Date:** 2026-07-28

## Nav (`lib/admin/adminNav.js`)

Billing and Revenue → Overview, Plans, Subscriptions, Invoices, Payments, Credits & Refunds, Reconciliation.  
Compliance → MRA EIS Entitlement (`/insightbooks/mra-eis`).

**Missing for program:** MRA EIS Plans, MRA EIS Subscriptions, MRA EIS Reconciliation/Reports/Settings under billing.

## Pages (`app/insightbooks/billing/**`)

| Page | Classification |
|------|----------------|
| overview, plans, invoices, payments, credits, reconciliation | KEEP / EXTEND |
| subscriptions | KEEP / EXTEND — `SHOW_EIS_SUBSCRIPTION_UI = false` hides EIS tab |
| Dedicated `/billing/mra-eis-plans/**` | GAP |

## Split brain

Admin can version `PlatformPlanVersion` (incl. seeded EIS), but public/tenant UIs still read `subscriptionConfig`. **EXTEND** to unify.

## Recommendations

1. Add nav items for MRA EIS Plans / Subscriptions (distinct from Entitlement)  
2. Enable and redesign EIS subscription management with Admin kit  
3. Plan wizard + preview as specified  
4. Apply granular permissions to legacy subscription APIs  
