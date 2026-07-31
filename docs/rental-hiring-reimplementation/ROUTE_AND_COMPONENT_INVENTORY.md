# Route & Component Inventory

## Navigation

| Path | Label | Permission |
|------|-------|------------|
| `/rentals` | Rentals | `rentals.view` |
| `/rentals/hiring` | Hiring | `rentals.view` |

Parent: **Rental & Hiring**. No sub-routes for contracts, deposits, dispatch, reports, settings.

## Pages

| Route | File | Notes |
|-------|------|-------|
| `/rentals` | `app/rentals/page.js` → `RentalsClient mode="rental"` | Calendar + book + asset CRUD |
| `/rentals/hiring` | `app/rentals/hiring/page.js` → `RentalsClient mode="hiring"` | Same UI, quantity pool |

**Missing pages (INCOMPLETE):** dashboard tabs, catalogue detail, availability centre, enquiries, quotations, reservations, contracts, dispatches, returns, inspections, damages, deposits, billing workbench, payments, maintenance, hire requests/orders/agreements, supplier bills, reconciliation, reports, settings.

## APIs

| Method | Path | Role |
|--------|------|------|
| GET/POST | `/api/rentals` | List / create booking+invoice |
| POST | `/api/rentals/check-availability` | Soft availability |
| GET | `/api/rentals/calendar` | Calendar events |
| GET | `/api/rentals/stats` | Simple stats |
| POST | `/api/rentals/complete` | Complete booking |
| POST | `/api/rentals/cancel` | Cancel booking |
| POST | `/api/rentals/items/return` | Partial return (hiring qty) |
| GET | `/api/rentals/default-revenue-account` | CoA helper |
| GET/POST | `/api/rental-assets` | Catalogue CRUD |
| GET/PATCH/DELETE | `/api/rental-assets/[id]` | Asset mutate |

## Components / libs

| File | Disposition |
|------|-------------|
| `app/rentals/RentalsClient.js` (~1.2k LOC) | `REFACTOR` — monolithic UI |
| `lib/rentalAvailability.js` | `EXTEND` |
| `lib/rentalBilling.js` | `EXTEND` |
| `lib/rentalInvoiceCalc.js` | `REUSE` |
| `lib/rentalLifecycle.js` | `REFACTOR` |
| `lib/defaultRentalRevenueAccount.js` | `EXTEND` |

## Deep links / mobile

No dedicated mobile dispatch/return flows. Calendar is day-based in UI; advisory blocked days computed client-side (`buildBlockedYmdSet`) — server revalidates on create only.
