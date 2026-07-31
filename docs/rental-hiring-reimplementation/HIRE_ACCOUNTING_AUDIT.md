# Hire Accounting Audit (Inbound)

## Finding

Inbound hire accounting **does not exist**.

Current `kind=hiring` posts **Customer Invoice revenue** (same as rentals). That is the opposite of Hire Expense / AP.

Purchases module (`SupplierBill`, supplier payments) can be **reused** for bill recognition once Hire Agreements exist, but there is no hire-specific matching, accrual, prepaid hire, or supplier deposit asset flow wired to rentals.

**Disposition:** `REIMPLEMENT` hire domain + `REUSE` supplier bill/payment adapters with hire source identities.

## Missing postings

- Direct hire bill (Expense/Project + Input tax / AP)  
- Accrued hire on approved usage  
- Prepaid hire amortisation  
- Supplier hire deposit asset  
- Idempotent payment clearing AP only  

See [RENTAL_HIRING_ACCOUNTING_POSTING_MATRIX.md](./RENTAL_HIRING_ACCOUNTING_POSTING_MATRIX.md).
