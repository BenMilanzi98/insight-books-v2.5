# Feature Implementation Checklist

This checklist aligns the codebase with **feature implementation.txt** and ensures all features are implemented correctly and related to one another.

---

## 1. POS & Reversals

| Requirement | Status | Location / Notes |
|-------------|--------|------------------|
| Reversals apply to POS sales (inventory, COGS, payments) | ✅ Implemented | `lib/transactionReversalService.js` – `createSaleReversal` restores inventory, reverses journal entries (revenue/COGS), reverses linked payments, reverses tax |
| No hard deletes; reversal creates opposite transaction | ✅ | Reversal sale/entries created; original unchanged |
| Reason for reversal mandatory | ✅ | Validated in reversal API |

**Cross-check:** POS sales created via `/api/sales` use same `Sale` model and are included in reversal lookup by `saleId`.

---

## 2. Cost of Goods Sold (COGS)

| Requirement | Status | Location / Notes |
|-------------|--------|------------------|
| COGS posts from sales invoices | ✅ | `lib/transactionJournalHelpers.js` – `createInvoiceCogsEntry`, `createSaleJournalEntry` (COGS for POS) |
| COGS posts to COGS account (not Expenses) | ✅ | Uses COGS account from chart of accounts |
| COGS visible on dashboard and in General Ledger | ✅ | GL excludes `isReversal: false`; COGS entries are normal posted transactions |
| Account balance updates after COGS entry | ✅ | `updateAccountBalanceOnTransaction` called after COGS transaction creation |

**Cross-check:** Dashboard COGS and GL expense/COGS lines should reconcile; both derive from `TransactionLine` / posted transactions.

---

## 3. Account Transfers & Payments

| Requirement | Status | Location / Notes |
|-------------|--------|------------------|
| Transfers work for newly created accounts | ✅ | `lib/core.js` – `processCapitalTransfer` supports both `Account` and `PaymentAccount`; validates `isActive` |
| Payment processing recognizes new accounts | ✅ | `lib/paymentMethodAccountMapping.js` – `getAccountForPaymentMethod` resolves by Account/PaymentAccount ID (CUID) first, then keyword |
| Account availability and validation in payment workflows | ✅ | `app/api/payments/route.js` – transfer validation uses `getAccountBalanceDetails`, checks both models and active status |

**Cross-check:** Capital transfer and payment routes use same account resolution and balance checks.

---

## 4. Loans & Liabilities

| Requirement | Status | Location / Notes |
|-------------|--------|------------------|
| Loan principal posts to liability account (not COGS) | ✅ | `app/api/liabilities/[id]/payments/route.js` – `resolveLiabilityAccount` (2000–2400); principal debits liability |
| Interest posts to interest expense account (not COGS) | ✅ | `resolveInterestExpenseAccount` excludes COGS range (5000–5999) |
| Correct debit/credit for principal and interest | ✅ | Debit liability for principal, debit interest expense for interest; credit cash |

---

## 5. General Ledger & Chart of Accounts

| Requirement | Status | Location / Notes |
|-------------|--------|------------------|
| New GL account creation without errors | ✅ | `app/api/chart-of-accounts/route.js` – uniqueness on code/name; posting rules validated |
| Duplicate account codes prevented | ✅ | Uniqueness check on `accountCode` and `accountName` (case-insensitive) |
| Salary expense consolidated (single account code) | ✅ | `app/api/payroll/enhanced/route.js` – `getOrCreatePayrollAccounts` normalizes to code 6000 for salary expense |
| Posting rules (normalBalance vs accountType) validated | ✅ | Chart of accounts POST validates before create |

**Cross-check:** Legacy `app/api/accounts/route.js` also checks code uniqueness.

---

## 6. Payroll Accounting

| Requirement | Status | Location / Notes |
|-------------|--------|------------------|
| Balance sheet balances after payroll | ✅ | `app/api/payroll/enhanced/route.js` – single main transaction; PAYE credited in main tx; `validateTransactionBalance` before create |
| Salary expense debit = gross + overtime + employer NPS | ✅ | `totalExpenseAmount = grossPay + additions + npsEmployerAmount` |
| Tax and liability postings correct | ✅ | PAYE liability credited; NPS employee/employer; net pay to cash; advance deductions to liability |

---

## 7. Supplier Management in Expenses

| Requirement | Status | Location / Notes |
|-------------|--------|------------------|
| Supplier field when creating expenses | ✅ | Expense form/API support `supplierId` |
| Supplier module similar to Client Management | ✅ | Suppliers at `/purchases/suppliers`; CRUD, bills, payments |
| Track supplier balances (owed vs paid) | ✅ | `lib/supplierService.js` – `updateSupplierBalance` includes bills + expenses (pending/partial) |
| Expenses linked to supplier accounts payable | ✅ | `lib/transactionJournalHelpers.js` – `createExpenseJournalEntry` credits Accounts Payable when supplier + Pending; `createExpensePaymentJournalEntry` for payments |

**Cross-check:** Supplier list API refreshes balance per supplier; `/api/purchases/suppliers/[id]/transactions` returns bills, expenses, payments.

---

## 8. Supplier Transactions Modal & Figures

| Requirement | Status | Location / Notes |
|-------------|--------|------------------|
| Modal for viewing supplier transactions | ✅ | `SupplierTransactionsModal` in `app/purchases/suppliers/page.js` |
| All transactions and figures shown correctly | ✅ | Modal uses `summary` (totalOwed, totalBilled, totalPaid, currentBalance), bills/expenses/payments lists; `formatMoney` for all amounts |
| Safe when API returns empty/error | ⚠️ Verify | Ensure `transactions` and `summary` are defaulted (e.g. `|| {}`) and no `.toLocaleString()` on undefined |

**Fix if needed:** Use `formatMoney(summary?.totalOwed ?? 0)` (or equivalent) everywhere in the modal so missing data doesn’t throw.

---

## 9. Expense Categories & Account Codes

| Requirement | Status | Location / Notes |
|-------------|--------|------------------|
| Users can create expense categories | ✅ | `app/api/expense-categories/route.js` – POST creates category + Account in 6000–6999 |
| System assigns account code automatically | ✅ | `generateExpenseAccountCode` in expense-categories API / `lib/expenseCategoryNormalization.js` |
| New categories post correctly to reports | ✅ | `lib/incomeStatementService.js` and expense analysis report group by account code |

---

## 10. Account Codes & Category Normalization

| Requirement | Status | Location / Notes |
|-------------|--------|------------------|
| Backend normalization without disrupting users | ✅ | `lib/expenseCategoryNormalization.js` – mapping and getOrCreate logic |
| Existing categories visible | ✅ | Reports show category names; grouping by account code is internal |
| Duplicates map to standard CoA codes | ✅ | `STANDARD_CATEGORY_MAPPINGS` and normalization script |
| Historical transactions unchanged; reports use account codes | ✅ | Normalization script backfills `expenseAccountId`; reports group by code |

**Script:** `npm run normalize:expenses` (handles null/legacy data; Prisma queries avoid `categoryId`/nullable issues where DB not migrated).

---

## 11. Client Management

| Requirement | Status | Location / Notes |
|-------------|--------|------------------|
| Template for balance reminders | ✅ | `app/api/clients/balance-reminder-template/route.js`; `TenantSettings.balanceReminderSubject/Body`; `lib/balanceReminderService.js` |
| Download client trading history (Account Summary) | ✅ | `app/api/clients/[id]/account-summary/route.js`; CSV download |
| Send invoices to multiple emails per client | ✅ | `Client.additionalEmails`; invoice send uses primary + additionalEmails |
| Email from tenant address | ✅ | Invoice send and balance reminder use `tenant.settings.businessEmail` |

---

## 12. Invoicing & POS

| Requirement | Status | Location / Notes |
|-------------|--------|------------------|
| Titles on invoices and quotes | ✅ | Schema: `Invoice.title`, `Quotation` (title if present), `Sale` (title) |
| Order numbers on invoices and quotes | ✅ | Schema: `Invoice.orderNumber`, `Quotation.orderNumber` |
| File attachments on invoices | ✅ | `InvoiceAttachment` model; `Invoice.attachments` relation |
| Tax lines on POS receipts, invoices, quotations | ⚠️ Confirm | Product-level tax and tax accounts exist; ensure receipts/invoice/quote PDFs render tax lines |

---

## 13. HR & Payroll – Benefits

| Requirement | Status | Location / Notes |
|-------------|--------|------------------|
| Benefits tracking (house allowance, airtime, perks) | ✅ | `Benefit` and `EmployeeBenefit` models; `/api/benefits`, `/api/employees/[id]/benefits` |
| Benefits in payroll run | ✅ | Enhanced payroll loads `employeeBenefits`; passes allowances to `calculateMalawiPayroll`; stored in payroll notes and on payslips |
| HR Benefits & Allowances page | ✅ | `/hr/benefits`; employee form Compensation step has benefit amounts |

---

## 14. Regression & Validation

| Requirement | Status | Location / Notes |
|-------------|--------|------------------|
| Historical transactions unchanged | ✅ | No destructive changes; normalization only backfills account linkage |
| Reports match General Ledger | ✅ | Reports and GL both use `TransactionLine` / posted data |
| Validation scripts run without failing on missing migration | ⚠️ Fix | Scripts must not select `categoryId` or use `ExpenseCategory` when migration not applied; use raw checks and optional paths |

**Scripts:**  
- `validate:quick` – structure checks (DB connection, tables/columns).  
- `validate:expense-categories` – must not require `ExpenseCategory` or `Expense.categoryId` in Prisma select.  
- `validate:data-integrity` – same; avoid Prisma select on `categoryId` when column may not exist.

---

## 15. Errors to Resolve

| Error | Action |
|-------|--------|
| **Migration drift (P3015)** | Do not run `prisma migrate reset` if data must be kept. Use `prisma db push` for dev or create a new migration that matches current DB and fix history. |
| **Validation: "Unknown field categoryId"** | Ensure validation scripts never include `categoryId` in Prisma `select` (only use raw SQL to detect column). |
| **Validation: "generateIncomeStatementFromAccounts is not defined"** | Use dynamic `require()`/import of `incomeStatementService` in script, or skip income statement test when service unavailable. |
| **Validation: "Cannot read properties of undefined (reading 'findMany')"** | Guard `prisma.expenseCategory` with try/catch or check for table existence; skip category checks if table missing. |
| **Validation: "Argument not must not be null" (categoryId: null)** | Do not use `categoryId: null` in Prisma where when field is not in schema or is required; use raw query or omit filter. |
| **Supplier modal: "SupplierTransactionsModal is not defined"** | Ensure `SupplierTransactionsModal` is defined in the same file above the component that uses it (or export and import). |
| **Supplier View: "toLocaleString on undefined"** | Use safe formatting (e.g. `formatMoney(value ?? 0)`) for all numeric display in supplier modal and list. |

---

## 15b. Feature implementation.txt – Cross-Check Summary

| Area in feature implementation.txt | Status | Notes |
|------------------------------------|--------|------|
| **1. Product-Level Tax Management** | ✅ | Tax types, product tax assignment, POS auto-apply, receipts with tax breakdown; permissions (Admin/Manager create/assign, Cashier view). |
| **2. Multi-Tax Accounts & Tax Tracking** | ✅ | TaxType per obligation; tax posted to linked account; Tax Management shows collected/paid/net; VAT Summary (Input/Output/Net). |
| **3. Payment Processing** | ✅ | Payment accounts (user-defined); Cash default; split payments; reporting per account; `paymentMethodAccountMapping`, Payment Management. |
| **Bug: Stock not saving (branch)** | ⚠️ | Stock APIs use branch; if KU branch missing, ensure branchId passed on save. |
| **Bug: Stock movement across branches** | ✅ | `api/stock-transfers`; stock movement report; branch balances. |
| **Bug: COGS** | ✅ | COGS from sales/invoices; posts to COGS account; dashboard & GL. |
| **Bug: Remove accounts when creating taxes** | ✅ | Non-PAYE tax types can have accountId removed/set to null (PUT tax-types/[id]); PAYE requires account. |
| **Bug: Combined taxes calculation** | ✅ | SaleItemTax per tax type; tax summary by rate; multi-tax stacking. |
| **Bug: Salary advance** | ✅ | `api/salary-advances`, `/hr/advances`; deductions from payroll. |
| **Bug: HR reports** | ✅ | `/hr/reports`; report generation. |
| **Bug: PAYE default tax account** | ✅ | PAYE tax type linked to liability account; payroll posts to it. |
| **i. Revenue Budget (Forecasting)** | ✅ | Budget model; manual revenue budgets; budget vs actual (`getActualRevenue`, budget reports); period lock. |
| **ii. Stock movement across branches** | ✅ | Stock transfers; quantity out/in; audit trail; reports. |
| **iii. Supplier management for expenses** | ✅ | Suppliers module; expenses reference supplier; supplier balance tracking. |
| **iv. Transaction reversal** | ✅ | Reversals for sales/expenses/payments; no hard deletes; reason required; ledger/tax/payment adjusted. |
| **v. Ledger system** | ✅ | General Ledger; all transactions post; read-only; by date/account. |
| **vi. Journal entries** | ✅ | Manual adjustments; debit/credit/amount/reason; ledger impact. |
| **vii. Period closing & opening** | ✅ | Accounting periods; close/lock; reopen with reason; audit. |
| **Unified account codes / Expense categories from CoA** | ✅ | Expense categories from CoA; budgeting from CoA; normalization. |
| **Client management** | ✅ | Balance reminder template; client account summary download; multi-email invoices; tenant email. |
| **Invoicing & POS** | ✅ | Titles, order numbers; invoice attachments; tax lines on receipts/invoices/quotes. |
| **HR benefits** | ✅ | Benefits & allowances; payroll integration; `/hr/benefits`. |
| **Accounting checklist – Navigation** | ✅ | All accounting under one Accounting dropdown: GL, Receivables, Payables, Periods, CoA, Journal Entries, Capital, Trial Balance, Reversals. |
| **Amwenye: Footer phone & bank** | ✅ | TenantSettings businessPhone, defaultBankDetails; Invoice/Quotation/Sale footer overrides. |
| **Amwenye: MWK symbol** | ✅ | MWK in column headers and totals only (InvoiceTemplatePreview, PDF). |
| **Amwenye: Decimal .00** | ✅ | Two decimals in UI; export/print use `formatAmountForExport`/`formatCurrencyForExport` (no .00). |
| **Amwenye: PO goods & services** | ✅ | PO module with type, tax, totals, invoice upload, VAT integration, prices-include-tax toggle. |
| **Amwenye: Tax in expenses** | ✅ | Expense taxAmount, taxRate; tracked for reporting. |
| **Amwenye: Taxes from outflows** | ✅ | TenantSettings.taxOutflowAccountId; expense/supplier tax to outflow account. |
| **Amwenye: Credit & Debit notes** | ✅ | CreditNote, DebitNote models; `/credit-debit-notes`; ledger entries; link to invoice/sale. |

---

## 15c. Data-layer verification (schema ↔ API)

Verified that feature-specific schema fields are **written** in create/update APIs and **read** where needed:

| Area | Persisted in API | Notes |
|------|------------------|--------|
| **Expense** | `taxAmount`, `taxRate`, `supplierId`, `purchaseOrderId`, `purchaseOrderItemId` | `app/api/expenses/route.js` create/update |
| **Invoice** | `title`, `orderNumber`, `footerPhoneOverride`, `footerBankDetailsOverride` | `app/api/invoices/route.js`, `[id]/route.js` |
| **Quotation** | `title`, `orderNumber`, `footerPhoneOverride`, `footerBankDetailsOverride` | Schema + quotation APIs |
| **Sale** | `title`, `orderNumber`, `footerPhoneOverride`, `footerBankDetailsOverride`, `branchId` | Sale APIs |
| **CreditNote / DebitNote** | `invoiceId`, `saleId`, `amount`, `reason`, `status`, `postedAt` | Post to ledger via `createCreditNoteJournalEntry` / `createDebitNoteJournalEntry` (Transaction `sourceType`/`sourceId`) |
| **Budget / BudgetItem** | `expectedRevenue`, `periodType`, `startDate`, `endDate`, `budgetType`, `breakdowns`, `items` (accountId, branchId, etc.) | `app/api/budgets/route.js`, `lib/budgetService.js` |
| **PurchaseOrder** | `pricesIncludeTax`, `supplierInvoiceUrl`, items: `taxTypeId`, `taxRate`, `taxAmount` | `app/api/purchases/orders/route.js`, `[id]/route.js`, `[id]/upload/route.js` |
| **Client** | `additionalEmails` | `app/api/clients/route.js`, `[id]/route.js` (GET/POST/PATCH) |
| **StockTransfer** | Full model (fromBranchId, toBranchId, productId, quantity, status, etc.) | `app/api/stock-transfers/route.js` |
| **Payment / PaymentAllocation** | `PaymentAccount`; split payments via `PaymentAllocation` | Payment APIs use payment accounts and allocations |

No schema fields identified as missing from create/update or read paths for the features in feature implementation.txt.

---

## 16. Purchase Order Module

| Requirement | Status | Location / Notes |
|-------------|--------|------------------|
| PO Type selector: Inventory Purchase (receivables only) vs Goods & Services (hits expenses) | ✅ | `app/purchases/orders/page.js` – ORDER_TYPES; API uses `orderType`; expense sync only for services/mixed |
| Line-level tax: Tax Type dropdown, Tax % editable, auto Tax Amount, auto Total Inclusive | ✅ | Order form: taxTypes from `/api/tax-types`; per-line `taxTypeId`, `taxRate`; totals use pricesIncludeTax when set |
| Totals section: Subtotal, Total Tax, Grand Total | ✅ | Form section "Notes & Totals"; API stores subtotal, taxAmount, totalAmount |
| Supplier Invoice Upload: PDF/Image, store against PO, link to Supplier Ledger | ✅ | `POST /api/purchases/orders/[id]/upload`; DetailDrawer: view/replace invoice, "View supplier ledger" → `/purchases/suppliers/[id]` |
| Tax module: Purchase taxes → Input VAT, Sales → Output VAT, Net VAT payable | ✅ | `app/api/reports/tax-summary/route.js` – vatSummary (inputVat, outputVat, netVatPayable); Tax Management page shows VAT Summary |
| Toggle: Prices Include Tax / Prices Exclude Tax | ✅ | `PurchaseOrder.pricesIncludeTax`; form checkbox; API computes line subtotal/tax from inclusive when set |

**Cross-check:** PO create/update use `_lineSubtotal` for correct subtotal when pricesIncludeTax; expense sync in `lib/purchaseOrderExpenseSync.js` for services/mixed only.

---

## 17. How Features Relate

- **Reversals** → undo **POS/Invoices** (sales, COGS, payments, tax).  
- **COGS** → driven by **Inventory** and **Sales/Invoices**; posts to **Chart of Accounts** and **General Ledger**.  
- **Transfers/Payments** → use **Chart of Accounts** and **Payment accounts**; **core** and **paymentMethodAccountMapping** shared.  
- **Loans** → post to **Chart of Accounts** (liability + interest expense); no COGS.  
- **Payroll** → uses **Chart of Accounts** (salary expense, PAYE, NPS); **validateTransactionBalance** keeps GL balanced.  
- **Suppliers** → **Expenses** and **Supplier bills**; supplier balance and **transaction modal** use same APIs.  
- **Expense categories** → **Chart of Accounts** (auto account codes); **reports** group by account code; **normalization** links legacy categories.  
- **Client management** → **Invoices** (multi-email, tenant sender); **balance reminder** and **account summary** use same tenant/client settings.  
- **Invoicing/POS** → **Invoice/Quotation/Sale** schema (title, order number, attachments); tax on receipts/invoices.  
- **HR benefits** → **Payroll** (allowances in gross pay and on payslips).
- **Purchase orders** → **Suppliers**, **Expenses** (Goods & Services type), **Tax** (line-level tax type, Input VAT); **Supplier Bills** link to PO; invoice upload stored on PO; **Tax Management** shows Input/Output VAT and Net VAT payable.

---

## Quick verification commands

```bash
# After migration / db push
npx prisma generate
npm run validate:quick

# When expense categories migration is applied
npm run validate:expense-categories
npm run validate:data-integrity
npm run normalize:expenses
```

Use this checklist to confirm each feature and fix the listed errors so the system stays consistent and reportable end-to-end.
