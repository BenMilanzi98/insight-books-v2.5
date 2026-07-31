# Hiring Workflow Audit

## Current meaning (code)

`kind=hiring` on `RentalAsset` / `RentalTransaction`:

- Quantity pool (`totalQuantity`)  
- Books against **Client** (customer)  
- Creates **Customer Invoice** + rental revenue  
- Partial returns reduce blocked quantity (`/api/rentals/items/return`)

This is **outbound equipment rental by quantity**, not inbound supplier hire.

**Disposition:** `CONSOLIDATE` into outbound “quantity-based rental”; **do not** map blindly to inbound Hiring.

## Target meaning (master prompt)

Hire Request → Approve → Supplier quotations → Hire Order/Agreement → Delivery → Usage → Supplier Bill → Match → AP → Payment → Return/Terminate → Reconcile

Creates **Hire Expense / Project Cost / Prepaid / Accrual / AP** — never Customer Rental Revenue.

## Gap

| Target stage | Present? | Disposition |
|--------------|----------|-------------|
| Hire Request | No | `REIMPLEMENT` |
| Supplier quotation compare | No | `REIMPLEMENT` |
| Hire Order / Agreement | No | `REIMPLEMENT` |
| Supplier deposit asset | No | `REIMPLEMENT` |
| Delivery (hired-in custody) | No | `REIMPLEMENT` |
| Usage / timesheet | No | `REIMPLEMENT` |
| Bill matching | No | `REIMPLEMENT` |
| Accrual / prepaid | No | `REIMPLEMENT` |
| Supplier payment (no re-expense) | No | `REIMPLEMENT` via purchases adapters |
| Reports / reconcile | No | `REIMPLEMENT` |

## Terminology recommendation

1. Rename current UI “Hiring” → **Equipment pools** / **Quantity rentals** (outbound).  
2. Introduce new nav **Inbound Hiring** (or keep “Hiring” for inbound after migrate).  
3. Preserve historical `kind=hiring` rows as outbound quantity bookings; document in cutover notes.  
4. Never post `kind=hiring` historical invoices as Hire Expense.
