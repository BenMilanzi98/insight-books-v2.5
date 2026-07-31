# Module Cutover Framework

Operational modules do not invent their own feature-flag logic. They call a
Module Accounting Adapter, which uses `runCutoverPosting`.

## Modes (`resolvePostingMode`)

| Mode | Authority | Behaviour |
| --- | --- | --- |
| `LEGACY` | Legacy | `legacyPost()` only |
| `SHADOW` / `DUAL_COMPARE` | Legacy | Legacy writes; V2 `executePosting` observes (failures logged, not thrown) |
| `NEW_ENGINE` | V2 | `executePosting` only; legacy must not run |
| `DISABLED` | None | `PostingDisabledError` |

Resolution is server-side (`AcctV2Configuration.defaultPostingMode` + flags such
as `accountingV2Enabled` / shadow). Frontend never chooses the mode.

## Adapter contract

1. Load source in tenant scope.
2. Build `AccountingContext` + engine input (`sourceReference`, dates, amounts,
   dimensions, metadata).
3. Call `submitViaCutover` / `runCutoverPosting` with a `legacyPost` closure.
4. Never write `JournalEntry` / balances from the adapter.
5. On `authority === 'V2'`, update operational link fields (e.g. `journalEntryId`)
   from `PostingResult`.

## Stage 1–2 wired adapters

| Adapter | Module / event | Entry points |
| --- | --- | --- |
| `expenseAdapter` | EXPENSES / EXPENSE_POSTED | `createExpenseJournalEntry` |
| `bankingAdapter` | BANKING / BANK_CHARGE, INTEREST_INCOME | `app/api/payments` (`bank_charge`, `interest_income`) |
| `invoiceAdapter` | SALES / INVOICE_POSTED | `createInvoiceJournalEntry` |
| `customerPaymentAdapter` | RECEIVABLES / CUSTOMER_PAYMENT_POSTED | `createInvoicePaymentJournalEntry` (+ payments + partial-payment) |
| `supplierBillAdapter` | PAYABLES / SUPPLIER_BILL_POSTED | `finalizeExpenseBill` |
| `supplierPaymentAdapter` | PAYABLES / SUPPLIER_PAYMENT_POSTED | `createSupplierPaymentEntry` |

## Stage 3A wired adapters

| Adapter | Module / event | Entry points |
| --- | --- | --- |
| `posSaleAdapter` | POINT_OF_SALE / INVENTORY_SOLD | `createSaleJournalEntries` |
| `costOfSalesAdapter` | INVENTORY / COST_OF_SALES_RECOGNIZED | POS COGS, `recordCOGSOnSale`, invoice COGS |
| `goodsReceivedAdapter` | PURCHASES / INVENTORY_RECEIVED | `createPurchaseReceiptJournalEntry` |
| `stockAdjustmentAdapter` | INVENTORY / STOCK_ADJUSTMENT_POSTED | `createInventoryWriteOffJournalEntry` |

## Stage 3B wired adapters

| Adapter | Module / event | Entry points |
| --- | --- | --- |
| `creditNoteAdapter` | SALES / CUSTOMER_CREDIT_NOTE_POSTED | `createCreditNoteJournalEntry` |
| `customerRefundAdapter` | RECEIVABLES / CUSTOMER_REFUND_POSTED | `createInvoiceRefundJournalEntry` |

## Stages 3C–6 wired adapters

See `remainingAdapters.js`: bank transfer, payroll, asset acquire/depreciation,
loan received/repayment, capital contribution, tax settlement, supplier credit,
owner drawing.

## Scaffolds (UI-pending only)

`scaffolds.js` — dividend declare/pay, asset disposal API, owner-drawing UI.
