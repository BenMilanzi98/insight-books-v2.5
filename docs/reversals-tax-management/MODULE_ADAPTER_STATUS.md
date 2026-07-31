# Module Adapter Status (Wave 6)

Canonical GL reverse path: `reverseSourceJournals` → `reverseJournal` (V2 only).  
Document reverse path: `lib/reversals` → `transactionReversalService.create*Reversal`.

| Module | Reverse path | Status |
|--------|--------------|--------|
| Invoice | `createInvoiceReversal` | Wired via façade |
| Expense | `createExpenseReversal` | Wired via façade |
| Payment | `createPaymentReversal` | Wired via façade |
| Sale / POS | `createSaleReversal` | Wired via façade |
| Supplier payment | `createSupplierPaymentReversal` | Wired via façade |
| Journal (manual) | `/api/accounting-v2/journals/[id]/reverse` | KEEP V2 |
| Tax settlement | `/api/tax/settle` + `TaxPayment` register dual-write | Wave 4 |
| Payroll | Document reverse + V2 sources | Legacy Transaction branches fail-closed where applicable |
| Bank recon / Equity / Close | Module-specific reverse perms | Out of scope for tax hub; do not fork engines |

## Retirement rule
Do not add new `Account.balance` mutations or legacy `Transaction` GL creates for financial reverse/settle. New work must call V2 adapters.
