# Deposit Accounting Audit

## Finding

**No** `RentalDeposit` model, API, UI, or liability posting path.

Customer payments against rental invoices use normal invoice settlement (clear AR). There is no refundable security deposit liability.

**Disposition:** `NOT_APPLICABLE` (absent) → `REIMPLEMENT` full deposit lifecycle per posting matrix.

## Target (summary)

Receipt → Dr Cash / Cr Customer Rental Deposits Liability  
Apply → Dr Liability / Cr AR  
Refund → Dr Liability / Cr Cash  
Forfeit → Dr Liability / Cr approved recovery revenue  

Never recognise refundable deposit as Rental Revenue.
