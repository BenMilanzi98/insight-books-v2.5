# Final Gap Register — Rental & Hiring

**Date:** 2026-07-25

## Critical

| ID | Gap | Area | Disposition |
|----|-----|------|-------------|
| G-C01 | “Hiring” nav is outbound qty rental, not inbound supplier hire | Domain | `CONSOLIDATE` + `REIMPLEMENT` inbound |
| G-C02 | Booking always creates Invoice + Revenue | Accounting | `INCORRECT_ACCOUNTING` / `REIMPLEMENT` |
| G-C03 | No Customer deposit liability path | Deposits | `REIMPLEMENT` |
| G-C04 | No concurrency-safe anti-overbook | Availability | `DUPLICATE_BOOKING_RISK` |
| G-C05 | No RentalContract / quotation / reservation lifecycle | Data | `REIMPLEMENT` |
| G-C06 | No inbound Hire Request/Agreement/Bill/Expense path | Hiring | `REIMPLEMENT` |
| G-C07 | Float money on rental rates/totals | Money | `REIMPLEMENT` Decimal |
| G-C08 | Zero automated tests | QA | Build suite |

## High

| ID | Gap | Disposition |
|----|-----|-------------|
| G-H01 | No Asset Register / Inventory links | `DISCONNECTED` |
| G-H02 | No dispatch / custody / inspection | `REIMPLEMENT` |
| G-H03 | Auto-complete releases without inspection | `UNSAFE` |
| G-H04 | No rate plans / pricing explanation | `REIMPLEMENT` |
| G-H05 | No damage / late-fee engines | `REIMPLEMENT` |
| G-H06 | No billing-period idempotency | `DUPLICATE_BILLING_RISK` |
| G-H07 | No supplier hire deposits / accruals / prepaid | `REIMPLEMENT` |
| G-H08 | Coarse permissions / no SoD | `EXTEND` |
| G-H09 | No reconciliation centre / reports | `REIMPLEMENT` |
| G-H10 | Cancel/complete vs GL credit notes incomplete | `INCOMPLETE` |
| G-H11 | No booking idempotency key | `DUPLICATE_POSTING_RISK` |
| G-H12 | Browser availability advisory | `EXTEND` |

## Medium

| ID | Gap | Disposition |
|----|-----|-------------|
| G-M01 | No project/cost centre on bookings | `EXTEND` |
| G-M02 | Limited rate units (day/hour) | `EXTEND` |
| G-M03 | Monolithic RentalsClient | `REFACTOR` |
| G-M04 | Notifications / document pack missing | `EXTEND` |
| G-M05 | Import/export Dry Run missing | `EXTEND` |

## Counts

| Severity | Count |
|----------|-------|
| Critical | 8 |
| High | 12 |
| Medium | 5 |

## Readiness

| Question | Answer |
|----------|--------|
| Audit complete? | **Yes** |
| Safe to claim master acceptance? | **No** |
| Safe to start Foundation? | **Yes, after approval** of this register + [REIMPLEMENTATION_PLAN.md](./REIMPLEMENTATION_PLAN.md) |

## Suggested first code slice (post-approval)

1. Lock terminology: rename outbound pool mode; scaffold inbound Hiring stubs.  
2. Harden availability with transactional locking + tests.  
3. Stop recognising full revenue at book (feature flag / draft invoice / deferred policy).  
4. Introduce RentalContract + deposit models without cutting over UI fully.
