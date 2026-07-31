# Database Model Audit

## JournalEntry (V2)
- `reversalStatus`, `originalJournalId`, `reversedByJournalId` — KEEP
- Event registry unique on source event — KEEP (idempotency)

## Document flags
Invoice/Expense/Payment/Sale/SupplierPayment/Transaction: `isReversal`, `reversedTransactionId` — indexes only, **no unique constraint** → race risk. EXTEND with TransactionReversal unique keys.

## ReversalAudit
`@@ignore` stub — REIMPLEMENT as TransactionReversal (+ lines/approvals/evidence).

## TaxType (~3053)
Fields: taxId, taxName, taxCode, taxRate (float), calculationType, accountId (single), status.  
Missing: effective dating, supersession, purpose mappings, period/return FKs.

## Related tax
ProductTax, SaleItemTax — KEEP (line snapshots).  
Missing: TaxPeriod, TaxReturn, TaxPayment, TaxCredit, TaxTransaction subledger, InvoiceItemTax/PurchaseItemTax tables.

## Fixed COA
2041 tax inflow / 2045 tax outflow via taxAccountsInitialization — dual track vs VAT_OUTPUT/VAT_INPUT purposes.
