# Rental & Hiring Accounting Posting Matrix (Target)

Source-of-truth: CoA → Accounting V2 engine → Journals → GL → reports.  
Bookings/quotations/reservations/hire orders: **no journals**.

## Outbound rentals

### Customer refundable deposit receipt

| | |
|--|--|
| Trigger | Deposit received, approved |
| Debit | Cash / Bank |
| Credit | Customer Rental Deposits Liability |
| Idempotency | `tenant + depositId + version + CUSTOMER_RENTAL_DEPOSIT` |

### Deposit refund / apply / forfeit

| Purpose | Debit | Credit |
|---------|-------|--------|
| Refund | Deposit Liability | Cash/Bank |
| Apply to invoice | Deposit Liability | AR |
| Forfeit | Deposit Liability | Damage/Late/Lost recovery revenue |

### Rental invoice (credit)

Dr AR · Cr Rental Revenue · Cr Output Tax  
Idempotency: `tenant + contract + line + period + pricingVersion + RENTAL_BILLING`

### Prepaid / deferred

Receipt: Dr Cash · Cr Deferred Rental Revenue  
Earn: Dr Deferred · Cr Rental Revenue

### Customer payment

Dr Cash · Cr AR — **never** re-credit Revenue

### Late fee / damage / delivery

Dr AR or Deposit Liability · Cr respective revenue accounts — once per charge id

### Dispatch / return

**No** COGS, **no** asset disposal/acquisition for reusable capitalised assets.

## Inbound hiring

### Hire request / order / agreement

**No journal.**

### Supplier refundable deposit

Dr Supplier Hire Deposits Asset · Cr Cash  
Refund/apply reverse or clear vs AP — never expense.

### Direct supplier hire bill

Dr Hire Expense / Project Cost (+ Input Tax) · Cr AP  
Idempotency: `tenant + supplierBillId + version + HIRE_BILL_RECOGNITION`

### Accrual on approved usage

Dr Expense/Project · Cr Accrued Hire Liability  
Bill clears accrual + variance once.

### Prepaid hire

Pay: Dr Prepaid · Cr Cash  
Consume: Dr Expense · Cr Prepaid

### Supplier payment

Dr AP · Cr Cash — **never** re-debit Hire Expense

## Current → target delta

| Current | Target |
|---------|--------|
| Invoice + revenue at book | Policy-owned recognition |
| No deposits | Liability / asset deposits |
| hiring = customer revenue | Inbound = expense/AP |
| No accruals | Optional accrual policy |
