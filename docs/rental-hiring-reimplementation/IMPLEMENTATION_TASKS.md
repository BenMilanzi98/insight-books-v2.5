# Implementation Tasks — Rental & Hiring

Check boxes only with evidence after approval.

## Phase 0 — Audit

- [x] Route inventory  
- [x] Database model audit  
- [x] Workflow audits (rental + hiring)  
- [x] Availability / pricing / billing / deposit / hire accounting audits  
- [x] Asset + Inventory integration audits  
- [x] Risk registers  
- [x] Permission / report / test audits  
- [x] Final gap register  
- [x] Posting matrix (target)  
- [x] Reimplementation plan  
- [x] Domain definitions  

## Phase 0.5 — Terminology (approved)

- [x] Rename outbound `hiring` UI to Quantity rentals  
- [x] Reserve **Supplier hiring** nav (`/rentals/inbound-hiring` shell)  
- [x] Keep DB `kind=hiring` for historical outbound pools  

## Phase 1 — Foundation (approved / in progress)

- [x] Concurrency locks (`SELECT … FOR UPDATE` via `lockRentalAssetForBooking`)  
- [x] Booking idempotency key (`tenantId` + `idempotencyKey`)  
- [x] Gate unsafe auto-complete (`rentalAutoCompleteExpired` default false)  
- [x] Decimal money columns + migration `20260725120000_rental_foundation`  
- [x] Feature flag invoice-on-book (`rentalPostInvoiceOnBook` / env)  
- [x] Unit tests: kinds, policy, availability, billing  

## Phases 2–16 slice (in progress — see V2_PHASE_NOTES.md)

- [x] Schema + migration `20260725130000_rental_hiring_v2`
- [x] Catalogue units + rate plans APIs
- [x] Contract lifecycle + allocation locks
- [x] Deposit liability posting (`RENTAL_CUSTOMER_DEPOSIT`)
- [x] Dispatch / return / inspection / charges
- [x] Billing period uniqueness gate
- [x] Inbound hire request → agreement → usage → accrual / supplier deposit
- [x] Workbenches `/rentals/contracts-v2`, `/rentals/inbound-hiring`
- [x] Unit tests (state, deposit remaining, billing keys, hire state)
- [x] Quotation / reservation APIs + UI (`/rentals/quotations-v2`)
- [x] Auto-invoice from billing periods (`invoiceContractPeriod`)
- [x] Deposit refund / apply / forfeit
- [x] Late fee + damage charges
- [x] Supplier bill ↔ accrual clear (`HIRE_ACCRUAL_CLEARED`)
- [x] Reconciliation centre (`/rentals/reconcile`)
- [x] Legacy booking gate (`rentalLegacyBookingEnabled`)
- [x] FINAL_READINESS_DECISION — engineering complete
- [x] Auto clear hire accruals on expense supplier bill
- [x] Allocation overlap tests + contract audit logs
- [x] `purchases.approve` on Manager template

See [REIMPLEMENTATION_PLAN.md](./REIMPLEMENTATION_PLAN.md), [COMPLETION_NOTES.md](./COMPLETION_NOTES.md).  
**No further rental/hiring engineering tasks open.**
