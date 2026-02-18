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

## 16. How Features Relate

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
