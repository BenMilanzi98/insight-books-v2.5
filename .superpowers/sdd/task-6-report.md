# Task 6 Report: Cloud snapshot builder

## Status

Implemented the operational cloud snapshot builder and authenticated, device-bound snapshot route.

## TDD

- **RED:** `npx vitest run test/desktop/snapshot.test.js` failed because `lib/desktop/cloud/snapshot.js` did not exist.
- **GREEN:** The same command passed after implementing `buildDesktopSnapshot` (1 test passed).
- **Regression:** `npx vitest run test/desktop/snapshot.test.js test/desktop/bind.test.js` passed (2 files, 16 tests).
- **Lint:** ESLint passed for all three Task 6 source/test files.

## Implementation

- Snapshot has the exact required top-level keys and explicit Prisma selects.
- Products expose `quantity` from `Product.stockLevel` and deduplicated legacy/current barcodes.
- Customers include active and archived rows; tax types and payment accounts are active-only.
- Open invoices include explicit item fields; payments are limited to the last 90 days.
- The route requires a tenant session and an active matching `DesktopDevice`; otherwise it returns 403 `DEVICE_NOT_BOUND`.

## Concerns

- No blocking concerns. The report file is intentionally excluded from the Task 6 commit per the requested three-file commit scope.
# Task 6 Report: Damage / repair operator hooks

## Status
Complete. No commit was created.

## Delivered
- Added `formatRentalTraceNote` and unit coverage for `REPAIR` and `DAMAGE` trace notes.
- Added authenticated tenant-scoped damage and repair endpoints. Damage creates a pending rental invoice with `source=DAMAGE`; repair creates a draft repair expense with `source=REPAIR`.
- Extended rental reports to classify tagged damage invoices as damages rather than revenue.
- Added Damage and Repair actions to the shared Rentals / Customer hire booking list.

## Verification
- `npx vitest run test/rentalSourceTags.test.js test/rentalReportsService.test.js` — PASS (9 tests).
- `npx eslint "lib/rentalSourceTags.js" "lib/rentalReportsService.js" "app/api/rentals/charges/damage/route.js" "app/api/rentals/charges/repair/route.js" "app/rentals/RentalsClient.js"` — PASS.

## Concerns
- Repair records stay Draft/Pending for the normal expense approval/payment workflow; they are immediately visible to rental reports through their trace note.
- Recording a repair requires the tenant's active postable `5380` Repairs & Maintenance account.

## Important findings follow-up (2026-08-11)
- Damage invoices now resolve the tenant's mapped `OTHER_INCOME` system-purpose account with the CoA V2 resolver (module `RENTALS`, transaction type `DAMAGE`), rather than the rental revenue default. This intentionally requires a valid configured mapping and does not invent a GL code.
- Damage and repair trace notes add `rentalSource=CUSTOMER_HIRE` for hiring bookings, and `customer_hire` reports include only matching tagged rows (while `space` excludes them).
- The repair action prompts for the affected asset when a booking has more than one item.
- Verification: `npx vitest run test/rentalSourceTags.test.js test/rentalReportsService.test.js` — PASS (11 tests).
- No commit was created.

## Desktop snapshot review follow-up (2026-08-15)

Command:
`npx vitest run test/desktop/snapshot.test.js`

Output:
```text
RUN  v4.1.2 C:/laragon/www/insight-books-v2.5

Test Files  1 passed (1)
Tests       8 passed (8)
Duration    932ms
```
