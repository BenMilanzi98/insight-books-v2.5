# Accounting Event Catalogue

32 event types (`AccountingEventType`) across 20 source modules (`AccountingSourceModule`).
Identity = `{businessId}:{module}:{sourceType}:{sourceId}:{eventType}:{eventVersion}`.
Posting templates (debit/credit resolution) are Phase 4 work; this catalogue fixes identities
and dimension policies now.

| Event type | Module | Typical source | Dimension policy (implemented) |
|---|---|---|---|
| INVOICE_POSTED | SALES/RECEIVABLES | Invoice | customer required, supplier prohibited |
| CUSTOMER_PAYMENT_POSTED | RECEIVABLES | Payment | customer required, supplier prohibited |
| CUSTOMER_CREDIT_NOTE_POSTED | RECEIVABLES | CreditNote | customer required |
| CUSTOMER_REFUND_POSTED | RECEIVABLES | InvoiceRefund | customer required |
| SUPPLIER_BILL_POSTED | PAYABLES | SupplierBill | supplier required, customer prohibited |
| SUPPLIER_PAYMENT_POSTED | PAYABLES | SupplierPayment | supplier required |
| SUPPLIER_CREDIT_POSTED | PAYABLES | DebitNote | supplier required |
| EXPENSE_POSTED | EXPENSES | Expense | default |
| PAYROLL_POSTED / PAYROLL_PAYMENT_POSTED | PAYROLL | PayrollRun | customer+supplier prohibited |
| INVENTORY_RECEIVED / INVENTORY_SOLD / COST_OF_SALES_RECOGNIZED / STOCK_ADJUSTMENT_POSTED | INVENTORY | GoodsReceipt/Sale/Adjustment | default |
| BANK_CHARGE_POSTED / INTEREST_INCOME_POSTED | BANKING | BankTransaction | default |
| LOAN_RECEIVED / LOAN_REPAYMENT_POSTED | LOANS | Liability | loan required |
| ASSET_ACQUIRED / DEPRECIATION_POSTED / ASSET_DISPOSED | FIXED_ASSETS | Asset | asset required |
| CAPITAL_CONTRIBUTION_POSTED / OWNER_DRAWING_POSTED | EQUITY | CapitalTransaction | owner OR shareholder required |
| DIVIDEND_DECLARED / DIVIDEND_PAID | EQUITY | Dividend | owner OR shareholder required |
| OPENING_BALANCE_POSTED / OPENING_STOCK_POSTED | OPENING_BALANCES | OpeningBalance | default |
| MANUAL_JOURNAL_POSTED / ADJUSTMENT_POSTED | MANUAL_JOURNAL | JournalEntry | default |
| REVERSAL_POSTED | (module of original) | original journal | default; identity prevents double reversal |
| PERIOD_CLOSED / YEAR_CLOSED | PERIOD_CLOSE / YEAR_END_CLOSE | AccountingPeriod | default |

Notes tying back to Phase 1 defects:
- Payroll gets ONE identity (`PAYROLL_POSTED` per run) — the dual-path double posting (R-24)
  becomes structurally impossible once routed through the registry.
- Sale COGS uses `COST_OF_SALES_RECOGNIZED` per sale — no more `-cogs` suffix collisions
  between modules.
- POS deposits and capital transfers must become journal-backed events before Phase 9 rollout
  (R-25); no balance-only event type exists in this catalogue by design.
- MIGRATION module is reserved for Phase 6 historical transition entries.
