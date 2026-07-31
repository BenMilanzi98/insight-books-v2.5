# Completion notes — remaining rental/hiring work

**Date:** 2026-07-25  
**Migration:** `20260725140000_rental_hiring_completion`

## Added in this slice

- Quotation + reservation services/APIs/UI (`/rentals/quotations-v2`)
- Auto Customer Invoice from contract bill (`invoice` / `bill` actions)
- Deposit refund / apply / forfeit postings
- Late fee charge on late return; damage charge on inspection
- Hire accrual clear vs supplier bill (`HIRE_ACCRUAL_CLEARED`)
- Tenant reconcile API + `/rentals/reconcile`
- Legacy booking disable flag (`rentalLegacyBookingEnabled` / env)
- `FINAL_READINESS_DECISION.md` — Conditional GO

## Env flags

| Env | Effect |
|-----|--------|
| `RENTAL_POST_INVOICE_ON_BOOK` | Legacy book-path invoice |
| `RENTAL_AUTO_COMPLETE_EXPIRED` | Unsafe auto-complete |
| `RENTAL_LEGACY_BOOKING_ENABLED=false` | Block POST `/api/rentals` create |

## Final residual close (same day)

- Expense supplier bill POST auto-clears matching hire accruals (`hireAccrualIds` optional body; else amount-fit for same supplier).
- HireAccrual stores `expenseAccountId` / `accruedLiabilityAccountId` at accrual time (`20260725150000_hire_accrual_accounts`).
- `purchases.approve` on Manager role template.
- Allocation overlap unit tests + contract command audit logs.

**Engineering status: complete.** Ops pilot/cutover is configuration only.
