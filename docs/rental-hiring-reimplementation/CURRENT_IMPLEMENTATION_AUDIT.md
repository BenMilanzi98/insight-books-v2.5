# Current Implementation Audit — Rental & Hiring

**Date:** 2026-07-25  
**Scope:** Routes, APIs, libs, Prisma models, accounting, UI, permissions, tests

## Executive summary

InsightBooks has a **thin outbound booking + invoice** module under `/rentals` and `/rentals/hiring`. Both modes:

1. Book a `RentalAsset` for a date range  
2. Create a **Customer Invoice** immediately  
3. Post via `postInvoiceAccounting` (AR + Revenue)  
4. Block calendar capacity via `RentalAssetAvailability`

There is **no** full contract lifecycle (quotation → reservation → deposit → dispatch → return → inspection → final bill). There is **no** inbound supplier hiring domain.

**Classification of module overall:** `INCOMPLETE` + `INCORRECT_ACCOUNTING` relative to master prompt (deposit/deferred/dispatch ownership) + `DISCONNECTED` from Asset Register / Inventory / Projects.

## What exists (REUSE / EXTEND)

| Area | Location | Disposition |
|------|----------|-------------|
| Nav Rentals / Hiring | `components/Sidebar/Sidebar.js` | `EXTEND` (rename hiring semantics) |
| Shared UI | `app/rentals/RentalsClient.js` | `REFACTOR` → split outbound vs inbound |
| Booking API | `app/api/rentals/route.js` | `REFACTOR` / `REIMPLEMENT` lifecycle |
| Assets CRUD | `app/api/rental-assets/*` | `EXTEND` → RentalOffering + Unit |
| Availability check | `lib/rentalAvailability.js`, check-availability route | `EXTEND` + concurrency |
| Billable units | `lib/rentalBilling.js` | `EXTEND` (Decimal, rate plans) |
| Invoice totals | `lib/rentalInvoiceCalc.js` | `REUSE` patterns |
| Lifecycle cleanup | `lib/rentalLifecycle.js` | `REFACTOR` (unsafe auto-complete) |
| Default revenue CoA | `lib/defaultRentalRevenueAccount.js` | `EXTEND` |
| Invoice posting | `postInvoiceAccounting` | `REUSE` for invoice path only |
| Permissions | `rentals.view/create/update/delete/export` | `EXTEND` matrix |
| Models | `RentalAsset`, `RentalTransaction`, `RentalItem`, `RentalAssetAvailability` | `EXTEND` / partial `REIMPLEMENT` |

## What is missing (REIMPLEMENT)

Outbound: catalogue types, serialised units, rate plans, quotations, reservations/holds, contracts, deposits, dispatch/custody, inspections, damages, late fees, extensions, swaps, billing engine with period uniqueness, deferred revenue, reconciliation centre, dedicated reports.

Inbound: hire requests, supplier quotations, hire orders/agreements, supplier deposits, delivery, usage/timesheets, bill matching, accruals, prepaid hire, hire returns, hire expense posting.

## Accounting behaviour today

| Event | Current effect | Target |
|-------|----------------|--------|
| Book rental/hiring | Invoice + `postInvoiceAccounting` | Depends on billing policy; often later |
| Quotation / reservation | N/A | No journal |
| Deposit | N/A | Liability, not revenue |
| Dispatch | N/A (status only loosely) | Custody only |
| Return | Partial qty for `hiring` only; complete deletes slots | Inspection gate |
| Payment | Via normal invoice payment | Clear AR only |

## Workers / jobs

No dedicated rental billing worker. `releaseExpiredRentals` runs on GET/POST list/create — auto-completes past-end bookings and **deletes availability** without inspection (`UNSAFE` / operational risk).

## Tests

**Zero** automated tests under `test/` matching rental/hiring (`TEST_COVERAGE_AUDIT.md`).

## Disposition legend used in this pack

`REUSE` · `EXTEND` · `REFACTOR` · `REIMPLEMENT` · `CONSOLIDATE` · `LEGACY_READ_ONLY` · `DUPLICATED` · `INCORRECT_CALCULATION` · `INCORRECT_ACCOUNTING` · `DUPLICATE_BOOKING_RISK` · `DUPLICATE_BILLING_RISK` · `DUPLICATE_POSTING_RISK` · `CROSS_TENANT_RISK` · `DISCONNECTED` · `INCOMPLETE` · `UNSAFE` · `BLOCKED` · `NOT_APPLICABLE`
