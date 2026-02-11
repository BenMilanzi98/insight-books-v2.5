# Mandatory Account Code Enforcement

## Rule
All financial records must reference a valid Chart of Accounts account. Records without an account reference are invalid and must not be created or reported.

## Scope
- Expenses, Recurring Expenses
- Budgets (Budget Items)
- Invoices (Invoice Items)
- Sales (Sale Items)
- Taxes (Tax Types)
- Journal/Transactions (Transaction Lines)
- Reports and exports

## Enforcement Points
### Database Constraints
Required (non-null) account references:
- `Expense.expenseAccountId`
- `RecurringExpense.expenseAccountId`
- `BudgetItem.accountId`
- `InvoiceItem.accountId`
- `SaleItem.accountId`
- `TaxType.accountId`

### API/Business Logic
- All create/update endpoints validate:
  - Account exists
  - Account is active
  - Account type matches the module (Expense, Income, Liability)
- Journal entry creation is mandatory for revenue and expense flows (no silent fallback).
- Payment method mapping must resolve to a CoA account (no fallback).

### UI/UX
- Forms require account selection and block submission until account selection is complete.
- Account dropdowns show account code + name.
- Provide a link to Chart of Accounts for missing categories.

## Migration Strategy
1. **Audit current data**
   - Run: `node scripts/audit-account-references.js`
   - Resolve missing or invalid account references before applying DB constraints.

2. **Map legacy data**
   - Expenses: map `category` to an Expense account (already supported in `scripts/map-expense-categories-to-accounts.js`).
   - Invoices/Sales: assign Income accounts per item (via product mapping or finance review).
   - Tax Types: assign Liability/Asset tax accounts.

3. **Block creation without accounts**
   - API validation rejects missing or invalid account IDs.

4. **Apply DB constraints**
   - After data is clean, push schema changes (`npx prisma db push`) or run a migration.

## Operational Notes
- Locked accounting periods still block changes, regardless of account mapping.
- Deactivated accounts remain valid for historical records but cannot be used for new transactions.
- Reports fail if invalid account references exist.
