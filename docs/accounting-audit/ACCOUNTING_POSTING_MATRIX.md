# Accounting Posting Matrix

Every business event with financial impact → its actual implementation. Verified by full-repo
sweep (app/ + lib/). Ledger legend: **T** = `Transaction`+`TransactionLine` (primary GL, via
`postGlEntry` unless noted), **J** = `JournalEntry`+`JournalEntryLine`, **AB** =
`AccountBalance` payment-method mirror, **Acct** = stored `Account.balance` update.
"Engine" = posts through `lib/accountingEngine/postGlEntry.js` (period check + duplicate check +
balance update). Expected treatment column reflects standard double entry.

| Module | Business Event | Source Entity | Actual Trigger | Actual Debit | Actual Credit | Expected Dr/Cr | Ledger | Duplicate Controls | Period Control | Findings |
|---|---|---|---|---|---|---|---|---|---|---|
| Sales/POS | Cash/POS sale | `Sale` | `createSaleJournalEntries` on create (`app/api/sales/route.js`) | Cash/payment-method acct (gross) | Revenue 4100/4150 (gross) | Dr cash (gross) / Cr revenue (net) + Cr VAT | T+Acct (engine) | sourceId `{saleId}-revenue` | Yes (soft-fail warn) | **HIGH**: revenue posted at gross while tax posted separately → tax can double-count |
| Sales/POS | Sale COGS | `Sale` | same trigger + `/api/cogs/sale` | COGS 5100 | Inventory 1300 leaf | same | T+Acct (engine) | `Sale-COGS:{saleId}` — **two callers share the key** | Yes | **CRITICAL**: POS path and `/api/cogs/sale` race on same source key |
| Sales | Sale tax | `SaleItemTax` | `autoPostTaxEntry` | — | Tax liability 2041/2045 | Cr VAT out of gross | T+Acct (engine) | `{saleId}-tax` | Yes | see gross-revenue finding |
| Sales | Sale void/refund | `Sale` | `reverseSaleGlForRefundInTx` | swapped | swapped | reversal journal | T+Acct | reversal lookup | partial | **HIGH**: verify refund route always reverses GL (void does) |
| Invoicing | Customer invoice (non-draft) | `Invoice` | `createInvoiceJournalEntry` on create | AR 1200 | Revenue + line accounts | Dr AR / Cr revenue + VAT | T+Acct (engine) | `Invoice:{id}-revenue` | Yes | tax separate entry |
| Invoicing | Draft→issued | `Invoice` | `invoices/[id]/route.js` status change | same | same | same | T+Acct | **checks `JournalEntry` table, but engine writes `Transaction`** | Yes | **CRITICAL**: wrong-table idempotency check → double-post window |
| Invoicing | Customer payment | `Payment` | `createInvoicePaymentJournalEntry` | Cash | AR 1200 | same | T+Acct (engine) | `{invoiceId}-payment-{referenceNumber}` (**unstable key**) | Yes | **HIGH**: reference regeneration defeats idempotency |
| Invoicing | Credit note / debit note | `CreditNote`/`DebitNote` | `createCreditNoteJournalEntry` etc. | Revenue / AR | AR / Revenue | same | T+Acct (engine) | note id | Yes | — |
| Invoicing | Invoice refund | `InvoiceRefund` | `invoices/refund/route.js` | Revenue/AR mapping | Cash | reversal of revenue+cash | **T direct create (bypasses engine)** | refund id | Yes | **HIGH**: bypasses engine validations |
| Invoicing | Invoice delete/void (alt path) | `Invoice` | `invoices/[id]/delete`, `invoiceDeleteService` | flips all lines with `sourceId=invoiceId` | — | proper reversal | **T direct create** | loop-based | Yes | **CRITICAL**: misses `{id}-revenue` / tax-suffixed sources; not `reverseGlEntry` |
| Payments | Transfer between accounts | `Payment` | `postPaymentTransferGlEntry` | To-account | From-account | same | T+Acct (engine) | `Transfer:{paymentId}` | Yes | — |
| Payments | Cash adjustment | `Payment` | `postPaymentAdjustmentGlEntry` | Cash | Owner capital | Dr/Cr per adjustment reason | T+Acct (engine) | `PaymentAdjustment:{id}` | Yes | adjustments credit equity directly |
| Payments | Generic payment errors | `Payment` | `payments/route.js` | — | — | — | — | — | — | **HIGH**: GL errors swallowed (`catch`+log) → payment saved without journal |
| Expenses | Expense approved (paid) | `Expense` | `createExpenseJournalEntry` on create | Expense account (validated 5xxx leaf) | Cash/payment map | same | T+Acct (engine) | `Expense:{id}` + assert | Yes | — |
| Expenses | Expense on account | `Expense` | same | Expense | AP 2110 | same | T+Acct (engine) | same | Yes | — |
| Expenses | Approve-later backfill | `Expense` | `postApprovedExpenseJournalIfMissing` | same | same | same | T+Acct (engine) | posted-GL existence check | Yes | safe complement to create-time post |
| Expenses | Non-supplier partial payment | `Expense`/`Payment` | `expenses/partial-payment` | **Expense (again)** | Cash | Dr AP / Cr cash | T+Acct (engine) | `ExpensePayment:{paymentId}` | Yes | **CRITICAL**: re-debits expense instead of clearing AP → double expense |
| Expenses | Recurring expense generation | `RecurringExpense` | `processRecurringExpense` | — | — | none until approval | none | — | n/a | correct (Pending only) |
| Purchases | Goods receipt (inventory) | `GoodsReceipt` | `createPurchaseReceiptJournalEntry` | Inventory | AP/GRNI | same | **J only, no Acct** | GR `inventoryAppliedAt` flag | Yes | **CRITICAL**: J-only; invisible to T-based reports |
| Purchases | Inventory bill finalize | `SupplierBill` | `finalizeInventoryPurchaseBill` | Inventory | AP | same | T+Acct (engine) | skips if `Transaction` GR found (**won't see J-only GR**) or `journalEntryId` set | Yes | **CRITICAL**: GR(J) + bill(T) can both post inventory/AP |
| Purchases | Expense bill finalize | `SupplierBill` | `finalizeExpenseBill` | Line expense accounts + input tax | AP | same | T+Acct (engine) | `journalEntryId` skip | Yes | — |
| Purchases | Supplier payment | `SupplierPayment` | `createSupplierPaymentEntry` | AP 2110 | Cash/1130-xx | same | **T + J dual write; no Acct update in function** | paymentId (no assert) | Yes | **CRITICAL**: dual ledger; merged reports double-count; balances stale |
| Purchases | Supplier payment input tax | `SupplierPayment` | inline in `purchases/payments/route.js` | Tax account | — (single line) | balanced tax reclass | **T with ONE line** | paymentId (collides multi-bill) | Yes | **CRITICAL**: unbalanced single-line journal |
| Purchases | Bill-cancel payment slice | `SupplierBill` | `createSupplierPaymentSliceReversalEntry` + `updateAccountBalance` | Cash | AP | reversal | **T + J + AB** | `BillCancelPaymentSlice:{billId}` | Yes | **HIGH**: triple surface |
| Purchases | Owner-contributed asset | `Asset` | `createOwnerContributedAssetEntry` | Asset | Owner capital (name/code 3100 lookup) | same | **T + J dual** | optional sourceId | Yes | **HIGH**: dual write + name-based equity lookup |
| Legacy COGS APIs | Purchase/payment/COGS | refs | `/api/cogs/*` (`cogsIntegration.js`) | per helper | per helper | duplicates modern paths | T+Acct (engine) | free-form reference sourceIds | Yes | **HIGH**: parallel legacy path still live |
| Inventory | Write-off/expiry loss | `InventoryTransaction` | `inventoryWriteOffJournal` | Loss 5290 | Inventory | same | T+Acct (engine) | pre-check T then legacy J | Yes | — |
| Inventory | Stock transfer (branch) | `StockTransfer` | `stockTransferService` | — | — | optional GRNI/in-transit | none | — | No | no GL for inter-branch moves (by design) |
| Payroll | Payroll run (enhanced) | `Payroll` | `payroll/enhanced/route.js` | Salary expense 5200 + employer costs | Net pay payable, PAYE 2130, NPS | same | T+Acct (engine) | `Payroll:{id}` | Yes | — |
| Payroll | Payroll process → expense | `Expense` | `payroll/[id]/process` → expense GL | Salary expense (again) | Cash | payment of net pay, not expense | T+Acct (engine) | `Expense:{id}` (different source key) | Yes | **CRITICAL**: second economic posting of same payroll if both paths used |
| Payroll | Salary advance | `SalaryAdvance` | `salary-advances/route.js` | Advance receivable 1216 | Cash | same | T+Acct (engine) | `SalaryAdvance:{id}` | Yes | — |
| Payroll | Gratuity payment | `GratuityPayment` | expense-journal path | Gratuity expense | Cash | same | T+Acct (engine) | expense id | Yes | **HIGH**: GL failure swallowed (try/catch), register still saved |
| Assets | Asset acquisition | `Asset` | `assets/route.js` `createTransactionWithEntries` | Asset 1500–1900 (category map) | Payment account / capital | same | **T direct create, no Acct update, no sourceId** | none | Yes | **CRITICAL**: bypass + no idempotency + stale balances |
| Assets | Depreciation | `DepreciationSchedule` | `assets/depreciation` | — | — | Dr depreciation expense / Cr accum. dep. | schedule only | — | No | **HIGH**: no GL posting; reports reading schedules bypass GL |
| Liabilities/Loans | Liability create (proceeds) | `Liability` | `liabilities/route.js` | Cash | Liability GL | same | T+Acct (engine) | `liability_opening:{id}` | Yes | errors logged, register saved anyway |
| Liabilities/Loans | Liability payment | `LiabilityPayment` | `liabilities/[id]/payments` | Liability + interest expense | Cash | same | **J lines + empty T header + AB + Expense rows** | `LiabilityPayment:{id}` | Yes | **CRITICAL**: 3–4 surfaces; orphan T header with no lines; expense may re-post |
| Capital | Capital contribution | GL only | `capital-account/contributions` | Cash/bank/asset | Contribution sub-acct under 3100 | same | T+Acct (engine) + `TenantSettings.ownerContributedCapital` counter | `capital_contribution` + generated ref (**weak key**) | Yes | **HIGH**: parallel settings counter preferred by summary → double-count surface |
| Capital | Capital transfer (legacy) | — | `core.js#processCapitalTransfer` | — | — | journaled transfer | **AB + Acct only, no journal** | none | **No** | **CRITICAL** (apparently unused; dangerous if called) |
| Opening balances | Typed opening balance | wizard | `openingBalanceService#postOpeningBalance` | Per account | OB equity 3190 | same | T+Acct (engine) | explicit idempotency key | Yes | strongest path in system |
| Opening balances | Bulk CoA opening | `accounts/opening-balances` | route | computed | computed | same | T+Acct (engine) | bulk key, **deletes prior Opening transactions first** | Yes | **HIGH**: destructive replace of history |
| Taxes | Tax settlement / WHT offset / reversal | — | `taxCalculationService` | Tax liability | Cash | same | T+Acct (engine) | TaxPayment/TaxOffset keys | Yes | — |
| POS cash | Cash-day deposit/sweep | `PosCashDayDeposit` | `posCashDayService` | — | — | Dr bank / Cr cash journal | **AB only** | deposit rows | **No** | **CRITICAL**: cash movement with no journal |
| Manual journals | Draft/post/reverse | `JournalEntry` | `journalService` | user lines | user lines | same | **J + Acct** | Posted early-return | **closed-only check** (`checkAccountingPeriodLock`) | **HIGH**: bypasses `assertPeriodOpen` open-coverage rule; posts into period gaps |
| Reversals | Generic reverse | `Transaction` | `transactions/reverse` → service | swapped | swapped | reversal journal | T (engine for GL branch; **direct create** in expense/invoice/sale branches) | reversal lookup | mixed (closed-only in direct branches; payroll checks reversal date not original period) | **HIGH** |
| COA | Account merge remap | `Account` | `chart-of-accounts/merge` | updates line FKs | — | n/a | line updates | — | No | can silently move history between accounts |

## Posting-path counts (final)

- **Engine-routed paths (T)**: ~30 business events.
- **Engine-bypassing journal writers**: 11 distinct locations (see `DUPLICATE_POSTING_ANALYSIS.md` and list below).
- **Dual T+J writers**: supplier payment, owner-contributed asset, bill-cancel slice, liability payment (partial).
- **Balance-only paths (no journal)**: POS cash deposits, `processCapitalTransfer`, `supplierBillCancelPayments` AB restore.
- **No-GL events that need GL**: depreciation posting, inter-branch stock in transit (policy decision).

## Engine-bypass list

1. `lib/purchaseAccounting.js` (GR JE, supplier payment dual, owner asset dual, slice reversal)
2. `lib/journalService.js` (manual journal lifecycle)
3. `app/api/assets/route.js` (`createTransactionWithEntries`)
4. `app/api/invoices/refund/route.js`
5. `app/api/invoices/[id]/delete/route.js` (+ `invoiceDeleteService`)
6. `app/api/liabilities/[id]/payments/route.js`
7. `app/api/purchases/payments/route.js` (unbalanced tax line)
8. `lib/transactionReversalService.js` (invoice/expense/sale direct-create branches)
9. `lib/posCashDayService.js` (AB only)
10. `lib/core.js` (`updateAccountBalance`, `processCapitalTransfer`)
11. `lib/supplierBillCancelPayments.js` (AB restore)
