# Database Model Audit

**Schema:** `prisma/schema.prisma` (~609–698)

## Models present

### RentalAsset

| Field | Notes | Disposition |
|-------|-------|-------------|
| tenantId, branchId | Scoped | `REUSE` |
| name, description, category | Commercial lite | `EXTEND` |
| kind (`rental` \| `hiring`) | Mode flag — **not** inbound hire | `REFACTOR` naming |
| status | Simple string (`available`/`booked`) | `INCOMPLETE` vs unit states |
| totalQuantity | Pool size for hiring | `REUSE` for quantity pools |
| defaultRate Float, rateUnit | Float money | `REIMPLEMENT` Decimal + rate plans |
| No assetId / productId | Disconnected from Asset Register / Inventory | `DISCONNECTED` |

### RentalTransaction

| Field | Notes | Disposition |
|-------|-------|-------------|
| invoiceId @unique | **1:1 invoice required** | `INCORRECT_ACCOUNTING` vs quotation/reservation |
| clientId | Customer only | `REUSE` for outbound |
| kind | rental/hiring | Same terminology issue |
| startAt/endAt, status | booked/active/overdue/completed | `INCOMPLETE` state machine |
| totalAmount Float | Float | `REIMPLEMENT` Decimal |
| No deposit, dispatch, return, pricingVersion | Missing | `REIMPLEMENT` |

### RentalItem

Line: asset, quantity, unitRate, billableUnits, total, returnedQuantity.  
No tax snapshot, no revenue account per line, no usage meters. **Disposition:** `EXTEND`.

### RentalAssetAvailability

Overlap window + quantity. Indexes on asset+range. **No exclusion constraint / advisory lock.**  
**Disposition:** `EXTEND` + `DUPLICATE_BOOKING_RISK`.

## Models absent (target)

RentalOffering, RentalUnit, RentalRatePlan, RentalReservation, RentalContract (+ lines), RentalDispatch, RentalReturn, RentalInspection, RentalCharge, RentalDeposit, HireRequest, HireAgreement, HireUsageRecord, supplier hire deposit, billing period uniqueness tables, idempotency keys on charges/billing.

## Constraints gaps

| Needed | Current |
|--------|---------|
| Non-overlapping serialised allocation | Soft check in TX only |
| Unique billing period | N/A (full invoice at book) |
| Deposit identity | N/A |
| Decimal money | Float |
| Link to Fixed Asset | N/A |
| Tenant on availability row | Via transaction join only |

## Disposition summary

| Model | Classification |
|-------|----------------|
| RentalAsset | `EXTEND` → Offering + Unit |
| RentalTransaction | `LEGACY_READ_ONLY` after Contract cutover / `REIMPLEMENT` |
| RentalItem | `EXTEND` |
| RentalAssetAvailability | `EXTEND` + concurrency hardening |
