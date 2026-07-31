# Rental Workflow Audit (Outbound)

## Current happy path

1. Create/select `RentalAsset` (`kind=rental`)  
2. Pick client + dates in UI  
3. `POST /api/rentals` → availability assert → Invoice + `RentalTransaction` + availability slot → `postInvoiceAccounting`  
4. Optional: complete / cancel APIs  
5. Past `endAt`: `releaseExpiredRentals` may auto-complete and delete slots  

## Target path (master prompt)

Enquiry → Quotation → Availability → Reservation → Contract → Deposit → Dispatch → Active → Usage/Extension/Billing → Return → Inspection → Damages → Final Invoice → Payment → Closure

## Gap by stage

| Stage | Current | Disposition |
|-------|---------|-------------|
| Enquiry / Quotation | Missing | `REIMPLEMENT` |
| Reservation / hold | Missing (book = invoice) | `REIMPLEMENT` |
| Contract aggregate | `RentalTransaction` ≈ booking | `REIMPLEMENT` |
| Deposit | Missing | `REIMPLEMENT` |
| Dispatch / custody | Missing | `REIMPLEMENT` |
| Active rental ops | List + calendar only | `INCOMPLETE` |
| Usage / meters | Missing | `REIMPLEMENT` |
| Extensions / swaps | Missing | `REIMPLEMENT` |
| Return / inspection | Complete only; no inspection | `REIMPLEMENT` |
| Damage / late fees | Missing | `REIMPLEMENT` |
| Periodic billing | Invoice at book | `INCORRECT_ACCOUNTING` vs policies |
| Payment | Invoice payments | `REUSE` allocation |
| Cancellation | Cancel API | `EXTEND` refunds/credits |

## Status commands

No controlled state machine. Status strings mutated via complete/cancel/lifecycle. **Disposition:** `UNSAFE` relative to “no generic setStatus”.
