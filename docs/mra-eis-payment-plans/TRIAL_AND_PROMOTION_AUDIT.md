# Trial and Promotion Audit

**Date:** 2026-07-28

## Trials

| Item | Classification |
|------|----------------|
| Core trial (`trial`, 2 days) | KEEP |
| EIS trial SKU | GAP / INCOMPLETE |
| Duplicate trial prevention | PARTIAL — needs one-trial-per-tenant policy for EIS |
| Trial expiry workers/emails | REUSE (`trialExpirationService`, expiry emails) |
| Trial→paid conversion preserving EIS config | GAP |

## Discounts / coupons

No first-class coupon/promotion engine for platform billing found. Admin can set invoice line amounts manually — INCOMPLETE for master prompt.

## Required

Configurable EIS trials, conversion, reminders, eligibility; coupon/discount with server-side application and non-negative totals.
