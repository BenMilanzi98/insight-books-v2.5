# Rental Billing Audit

## Current policy (implicit)

**BILL_AT_BOOKING:** creating a rental/hiring booking always creates a Customer Invoice and posts revenue via `postInvoiceAccounting`.

No billing period registry, no recurring job, no usage billing, no “bill at return”, no deferred revenue schedule.

## Risks

| Risk | Disposition |
|------|-------------|
| Revenue before dispatch/earning | `INCORRECT_ACCOUNTING` |
| No period uniqueness table | `DUPLICATE_BILLING_RISK` if periodic added later without design |
| Reprint/retry of create | Relies on invoice adapter idempotency; booking itself not keyed | `DUPLICATE_POSTING_RISK` |
| Complete/cancel vs credit notes | Incomplete linkage | `INCOMPLETE` |

## Target

Canonical `generateRentalBilling({…, idempotencyKey})` with period uniqueness and policy ownership of recognition. **Disposition:** `REIMPLEMENT`.
