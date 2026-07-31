# Foundation Phase Notes — Rental & Hiring (2026-07-25)

Approved after audit; Phase 0.5 + Phase 1 delivered.

## Delivered

| Item | Status |
|------|--------|
| UI: Quantity rentals (outbound pools) | Done |
| UI: Supplier hiring shell `/rentals/inbound-hiring` | Done |
| `lockRentalAssetForBooking` + `assertCanBookLocked` | Done |
| Booking `idempotencyKey` unique per tenant | Done |
| Auto-complete gated (`rentalAutoCompleteExpired` default false) | Done |
| Decimal money on rental asset/transaction/items | Done |
| Optional invoice + `rentalPostInvoiceOnBook` flag | Done |
| Migration `20260725120000_rental_foundation` | Applied |
| Unit tests (15) | Passing |

## Operator notes

- Existing tenants keep **invoice-on-book = true** (compat). Set `TenantSettings.rentalPostInvoiceOnBook = false` or env `RENTAL_POST_INVOICE_ON_BOOK=false` to book without GL until billing engine owns recognition.
- Past-end bookings become **overdue** only unless `rentalAutoCompleteExpired` is enabled.
- DB `kind=hiring` still means outbound quantity pool.

## Next phases

Catalogue/Units → Availability buffers → Rate plans → Contracts/deposits → Dispatch → Inbound hire models (see REIMPLEMENTATION_PLAN).
