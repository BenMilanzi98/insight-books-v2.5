# Payment Gateway Audit

**Date:** 2026-07-28

## SaaS gateway

| Gateway | Classification |
|---------|----------------|
| PayChangu (`app/api/subscription/paychangu/**`) | KEEP / HARDEN — sole hosted checkout |
| Stripe/PayPal/Flutterwave for SaaS | NOT_APPLICABLE |

## Critical gap — UNSAFE

`create-session` trusts client-supplied `amount`. Server must resolve plan → canonical price from catalog/`PlatformPlanVersion` and reject mismatches.

## Callback

Verifies tx_ref, currency, amount ≥ stored subscription amount — KEEP. Does **not** write `PlatformPayment` — DISCONNECTED / EXTEND.

## EIS

Backend expiry helpers know `eis-monthly` / `eis-yearly`. Tenant UI never sends EIS plans. Admin activate supports bank/mobile/card/cash.

## Rule

Never confuse tenant AR “PayChangu” payment method with SaaS PayChangu checkout.
