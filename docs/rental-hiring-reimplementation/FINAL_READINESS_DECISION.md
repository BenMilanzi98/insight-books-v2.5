# Final Readiness Decision — Rental & Hiring V2

**Date:** 2026-07-25  
**Decision:** **ENGINEERING COMPLETE** — ready to proceed to the next programme item.  
Ops pilot cutover of legacy booking remains a **tenant configuration** step, not an open engineering task.

## Evidence shipped

| Gate | Status | Evidence |
|------|--------|----------|
| Foundation (locks, idempotency, Decimal, auto-complete gate) | Met | `20260725120000_rental_foundation` |
| Catalogue / contracts / allocations | Met | Schema + `/api/rentals-v2/*` |
| Deposits liability (receive / refund / apply / forfeit) | Met | `depositService` + `RENTAL_CUSTOMER_DEPOSIT` |
| Dispatch / return / inspection / late+damage charges | Met | `operationsService` |
| Billing uniqueness + customer invoice | Met | `invoiceContractPeriod` |
| Quotation / reservation (no journals) | Met | `/rentals/quotations-v2` |
| Inbound hire + accrual + auto-clear on expense bill | Met | `HIRE_COST_ACCRUAL` / `HIRE_ACCRUAL_CLEARED` + `clearHireAccrualsForSupplierBill` |
| Reconciliation centre | Met | `/rentals/reconcile` |
| Legacy booking gate | Met | `rentalLegacyBookingEnabled` / env |
| Automated unit tests | Met | vitest rental/hiring suites (overlap, state, policy, billing) |
| Audit trail on contract commands / bill clear | Met | `AuditLog` |

## Closed engineering residuals

1. ~~Auto-hook accrual clear on supplier bill~~ — expense bill finalize calls `clearHireAccrualsForSupplierBill` (explicit `hireAccrualIds` or amount-fit match).
2. ~~`purchases.approve` missing from role template~~ — added to Manager template.
3. ~~Allocation overlap unit coverage~~ — `test/rentalV2Allocation.test.js`.

## Ops-only (not blocking next engineering work)

1. Pilot one tenant on Contracts V2 + Supplier hiring.
2. Optionally set `rentalLegacyBookingEnabled=false` (or `RENTAL_LEGACY_BOOKING_ENABLED=false`) after pilot.
3. Weekly `/rentals/reconcile` until stable.

## Sign-off

| Role | Result |
|------|--------|
| Engineering | **COMPLETE** — 2026-07-25 |
| Ops / Finance pilot | Optional follow-up configuration |

**Verdict:** No further rental/hiring engineering work required to start the next item. Legacy dual-run stays available until ops disables it per tenant.
