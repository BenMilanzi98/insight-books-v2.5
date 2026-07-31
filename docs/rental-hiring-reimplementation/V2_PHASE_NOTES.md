# Rental & Hiring V2 — Phase notes (2–16 slice)

**Date:** 2026-07-25  
**Migration:** `prisma/migrations/20260725130000_rental_hiring_v2` (applied)

## Shipped

| Area | Evidence |
|------|----------|
| Catalogue / units / rate plans | Schema + `/api/rentals-v2/units`, `/rate-plans` |
| Contracts + state machine | `lib/rentalV2/contractState.js`, `contractService.js`, `/api/rentals-v2/contracts` |
| Allocation concurrency | `lib/rentalV2/allocation.js` (`FOR UPDATE` on units + overlap checks) |
| Deposits as liability | `RENTAL_CUSTOMER_DEPOSIT` event + `depositService.receiveDeposit` |
| Dispatch / return / inspection / charges | `operationsService.js` + contract actions |
| Billing period uniqueness | `RentalBillingPeriod` unique + `billingService.billContractPeriod` |
| Inbound hire | `HireRequest` → `HireAgreement` → usage → optional `HIRE_COST_ACCRUAL` |
| Supplier hire deposit | `HIRE_SUPPLIER_DEPOSIT` asset posting |
| Workbenches | `/rentals/contracts-v2`, `/rentals/inbound-hiring` |
| Unit tests | `test/rentalV2ContractState.test.js` (+ foundation suite) |

## Accounting events registered

- `RENTAL_CUSTOMER_DEPOSIT` — Dr Cash; Cr Customer deposits liability  
- `HIRE_SUPPLIER_DEPOSIT` — Dr Deposit asset; Cr Cash  
- `HIRE_COST_ACCRUAL` — Dr Hire expense; Cr Accrued hire (ACCRUE policy only)

Templates, source validators, dimension policy, journal prefixes, and adapter exports are wired.

## Later completion (see COMPLETION_NOTES.md)

Quotation/reservation UI, auto-invoice, deposit refund/apply/forfeit, late fees, hire accrual clear, reconcile centre, legacy booking gate, and **FINAL_READINESS_DECISION (Conditional GO)** are delivered.

Still residual for full fleet cutover: SoD/notifications, soak concurrency tests, auto-hook clear-accrual inside every purchase bill finalize, ops pilot sign-off.

Legacy `/api/rentals` remains until `rentalLegacyBookingEnabled=false`.
