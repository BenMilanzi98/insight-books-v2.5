# Rental Availability Audit

## Implementation

- Server: `sumBookedQuantityForWindow` + `assertCanBook` in `lib/rentalAvailability.js`  
- API: `POST /api/rentals/check-availability`  
- UI: client-side `buildBlockedYmdSet` (advisory)  
- Persistence: `RentalAssetAvailability` rows  

## Behaviour

| Kind | Rule |
|------|------|
| `rental` | Any overlapping active booking → reject |
| `hiring` | Sum(qty) + requested ≤ totalQuantity |

Active statuses: `booked`, `active`, `overdue`.

## Gaps vs target engine

| Requirement | Status | Disposition |
|-------------|--------|-------------|
| Server-side authoritative | Partial | `EXTEND` |
| Revalidate on confirm/dispatch | Only on create | `INCOMPLETE` |
| Prep / inspection / cleaning buffers | Missing | `REIMPLEMENT` |
| Maintenance / quarantine / disposed | Missing | `REIMPLEMENT` |
| Branch transfer / holidays / blackouts | Missing | `REIMPLEMENT` |
| Serialised unit identity | Asset-level only | `REIMPLEMENT` |
| Concurrent double-book prevention | TX check without row lock / exclusion | `DUPLICATE_BOOKING_RISK` |
| Explicit unavailable reasons | Error strings only | `EXTEND` |
| Operator availability | Missing | `REIMPLEMENT` |

## Concurrency finding

Two parallel `POST /api/rentals` can both pass `assertCanBook` before either inserts availability → overbook. No `SELECT FOR UPDATE` on asset, no exclusion constraint.

**Severity:** High (`DUPLICATE_BOOKING_RISK`).
