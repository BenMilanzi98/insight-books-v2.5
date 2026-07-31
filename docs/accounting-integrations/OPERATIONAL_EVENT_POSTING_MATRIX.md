# Operational Event Posting Matrix

| Module | Source Entity | Business Event | Current Trigger | Current Accounting Logic | Target Event Type | Target Debit | Target Credit | Tax | Dimensions | Period Rule | Reversal Rule | Idempotency Identity | Legacy Shutdown Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sales | Invoice | Invoice issued | create/update non-draft | `createInvoiceJournalEntry` + tax | `INVOICE_POSTED` | AR | Revenue (+VAT out) | VAT Output | customer, branch, tax | posting date → resolver | Credit note / reverse | `…:Invoice:{id}:INVOICE_POSTED:1` | Guarded via postGlEntry; route not V2 |
| Sales | Invoice | Invoice payment | partial-payment / payments | `createInvoicePaymentJournalEntry` | `CUSTOMER_PAYMENT_POSTED` | Cash/Bank/MM | AR | n/a | customer, bank | posting date | Payment reversal | `…:Payment:{id}:CUSTOMER_PAYMENT_POSTED:1` | Unstable ref key → replace |
| Sales | CreditNote | Credit issued | credit-notes API | createCreditNoteJournalEntry | `CUSTOMER_CREDIT_NOTE_POSTED` | Sales returns (+VAT) | AR | VAT adj | customer | posting date | Reverse credit | CreditNote id | Pending adapter |
| Sales | InvoiceRefund | Refund | refund route | **direct Transaction** | `CUSTOMER_REFUND_POSTED` | AR/credit | Cash/Bank | per policy | customer, bank | posting date | Reverse refund | InvoiceRefund id | **BYPASS — shutdown** |
| POS | Sale | Sale completed | sales POST | createSaleJournalEntries + tax | `POS_SALE_POSTED` / cash sale | Cash/Bank/MM | Revenue (+VAT) | VAT Output | branch, payment | posting date | Refund/void reverse | Sale id + event | Pending; kill dual COGS |
| POS | Sale | COGS | sale helper + `/api/cogs/sale` | postGlEntry ×2 callers | `COST_OF_SALES_RECOGNIZED` | COGS | Inventory | n/a | item, location | posting date | Reverse with refund | Sale id COS event | **DUPLICATE RISK** |
| POS | PosCashDayDeposit | Cash deposit | posCashDayService | **AB only** | `BANK_TRANSFER` / cash deposit | Bank | Cash | n/a | bank | posting date | Reverse deposit | Deposit id | **BYPASS — journal required** |
| Purchases | GoodsReceipt | Inventory receipt | applyGoodsReceipt | **JE only** | `GOODS_RECEIVED_POSTED` or ops-only | Inv / GRNI | GRNI / AP | policy | supplier, location | posting date | Reverse GR | GoodsReceipt id | Policy: GRNI vs bill-only |
| Purchases | SupplierBill | Bill finalize | finalize*Bill | postGlEntry | `SUPPLIER_BILL_POSTED` | Exp/Inv/Asset (+VAT in) | AP | VAT Input | supplier, project | posting date | Supplier credit | SupplierBill id | Pending adapter |
| Purchases | SupplierPayment | Pay bill | createSupplierPaymentEntry | **dual T+J, no AB** | `SUPPLIER_PAYMENT_POSTED` | AP | Bank/Cash | n/a | supplier, bank | posting date | Payment reverse | SupplierPayment id | **BYPASS — shutdown dual** |
| Purchases | SupplierCredit | Credit | (module path) | varies | `SUPPLIER_CREDIT_POSTED` | AP | Exp/Inv/Asset | VAT adj | supplier | posting date | Reverse | SupplierCredit id | Pending |
| Expenses | Expense | Approved paid/on-acct | createExpenseJournalEntry | postGlEntry | `EXPENSE_POSTED` | Expense (+VAT) | Cash/AP | VAT Input | category→CoA leaf | posting date | Expense reverse | Expense id | Partial-pay bug fix |
| Expenses | Expense/Payment | Partial pay | expenses/partial-payment | may re-debit expense | `SUPPLIER_PAYMENT`/`EXPENSE_PAYMENT` | AP | Cash | n/a | — | posting date | Reverse | Payment id | **CRITICAL fix** |
| Expenses | RecurringExpense | Template fire | processRecurringExpense | none until instance | (none on template) | — | — | — | — | n/a | n/a | Instance id only | Keep non-posting |
| Payroll | Payroll | Run approved | payroll/enhanced | postGlEntry | `PAYROLL_POSTED` | 5200 + employer | PAYE/pension/net pay | statutory | employee | pay period + posting | Payroll reverse | Payroll id | Kill process-expense double |
| Payroll | Payroll/Expense | Net pay paid | process → expense | expense journal | `PAYROLL_PAYMENT_POSTED` | Payroll payable | Bank | n/a | — | posting date | Reverse | Payroll payment id | One workflow |
| Payroll | SalaryAdvance | Advance | salary-advances | postGlEntry | advance event / expense pattern | Receivable | Cash | n/a | employee | posting date | Reverse | SalaryAdvance id | Pending |
| Inventory | InventoryTransaction | Write-off | writeOff journal | postGlEntry | `STOCK_ADJUSTMENT_POSTED` | Loss | Inventory | n/a | item, location | posting date | Reverse | Tx id | Pending template ACTIVE |
| Inventory | StockTransfer | Transfer | stockTransferService | usually no GL | optional inter-acct | Dest inv | Src inv | n/a | locations | posting date | Reverse | Transfer id | Policy |
| Banking | Payment transfer | Transfer | paymentGlPosting | postGlEntry | `BANK_TRANSFER` | Dest bank | Src bank | n/a | banks | posting date | Reverse | Payment id | Pending adapter |
| Banking | Payment adj | Cash adj | paymentGlPosting | postGlEntry | adjustment / equity policy | per reason | per reason | n/a | — | posting date | Reverse | Payment id | Review equity credit |
| Assets | Asset | Acquire | assets route | **direct Tx, no AB** | `ASSET_ACQUIRED` | Fixed asset (+VAT) | AP/Bank | VAT Input | asset, supplier | posting date | Disposal/reverse | Asset id | **BYPASS — shutdown** |
| Assets | DepreciationSchedule | Monthly dep | depreciation route | **schedule only** | `DEPRECIATION_POSTED` | Dep expense | Accum dep | n/a | asset | period | Reverse dep | Asset+period | **MISSING GL** |
| Assets | Asset | Dispose | (incomplete) | — | `ASSET_DISPOSED` | Bank/Accum/Loss | Cost/Gain | n/a | asset | posting date | — | Disposal id | Pending |
| Loans | Liability | Proceeds | liabilities POST | postGlEntry | `LOAN_RECEIVED` | Bank | Loan liability | n/a | loan | posting date | Reverse | Liability id | Error swallow fix |
| Loans | LiabilityPayment | Repay | payments route | **JE+empty T+AB** | `LOAN_REPAYMENT_POSTED` | Liability + interest | Bank | n/a | loan, bank | posting date | Reverse | LiabilityPayment id | **BYPASS — shutdown** |
| Tax | Tax calc | Auto tax on source | autoPostTaxEntry | postGlEntry | embed in source event OR `TAX_POSTED` | — | Tax liability | VAT/WHT | tax code | posting date | reverseAutoPost | source-tax key | Prefer embed in source |
| Tax | TaxPayment | Settlement | tax/settle | postGlEntry | `VAT_SETTLEMENT` etc. | Tax payable | Bank | — | — | posting date | Reverse | TaxPayment id | Pending |
| Equity | Capital contrib | Contribution | capital-account | postGlEntry | `CAPITAL_CONTRIBUTION_POSTED` | Bank/Asset | Owner capital | n/a | owner | posting date | Reverse | Contribution id (stable) | Strengthen key |
| Equity | Drawing | Drawing | (module) | varies | `OWNER_DRAWING_POSTED` | Drawings | Bank | n/a | owner | posting date | Reverse | Drawing id | Pending |
| Equity | Dividend | Declare/pay | (module) | — | `DIVIDEND_DECLARED` / `DIVIDEND_PAID` | RE / Div payable | Div payable / Bank | n/a | shareholder | posting date | Reverse | Dividend id | Pending |
| Opening | OB batch | Opening | openingBalanceService | postGlEntry / V2 OB | `OPENING_BALANCE_POSTED` | per account | OB equity | n/a | — | open period | Controlled | Batch key | V2 exists |
| Manual | JournalEntry | Manual post | journalService / V2 | V2 or legacy JE | `MANUAL_JOURNAL_POSTED` | user lines | user lines | n/a | — | resolver | Reversal JE | Journal id | V2 ACTIVE |
| Imports | Batch rows | Historical | batch-upload | legacy helpers | same events via engine | same | same | — | — | posting date | per event | Batch+row id | Pending |
| Webhooks | Provider event | Payment success | (none today) | — | → `CUSTOMER_PAYMENT_POSTED` | Cash | AR | — | — | posting date | Reverse | Provider event id | Design-ready |
| Jobs | Cron GR / POS cash | Deferred apply | cron routes | JE / AB | same module events | same | same | — | — | posting date | — | Job+source id | Idempotent cutover |

## Legend — Legacy Shutdown Status
- **Pending adapter** — still on postGlEntry; guard will refuse when NEW_ENGINE owns event
- **BYPASS — shutdown** — must stop writing outside engine before/at cutover
- **V2 ACTIVE** — already on Posting Engine
- **MISSING GL** — must gain journal posting (not only operational registers)
