# Regression Testing & Validation Guide

## Overview

This guide provides comprehensive validation procedures to ensure:
1. ✅ Historical transactions remain unchanged
2. ✅ Reports match General Ledger after fixes
3. ✅ Feature works with existing and newly created users

## Quick Start

### 1. Quick Validation (Fastest)
```bash
npm run validate:quick
```
This runs basic checks on database structure and constraints.

### 2. Comprehensive Validation
```bash
# Validate expense categories feature
npm run validate:expense-categories

# Validate data integrity
npm run validate:data-integrity
```

### 3. Manual Testing
Follow the detailed checklist in `VALIDATION_CHECKLIST.md`

## Validation Scripts

### 1. `validate-expense-categories.js`

**Purpose:** Validates the expense categories feature end-to-end

**What it checks:**
- ✅ Historical transactions remain unchanged
- ✅ Expense categories are created correctly
- ✅ Reports match General Ledger
- ✅ New category creation logic works
- ✅ Backward compatibility maintained

**Usage:**
```bash
# With default tenant (first tenant in database)
npm run validate:expense-categories

# With specific tenant
TENANT_ID=your-tenant-id npm run validate:expense-categories
```

**Output:**
- Green ✓ for passed validations
- Red ✗ for failed validations
- Yellow ⚠️ for warnings

### 2. `validate-data-integrity.js`

**Purpose:** Validates data integrity and relationships

**What it checks:**
- ✅ Foreign key relationships are valid
- ✅ No orphaned records exist
- ✅ Account balances are consistent
- ✅ Transaction integrity is maintained

**Usage:**
```bash
npm run validate:data-integrity
```

### 3. `quick-validation.sh`

**Purpose:** Quick database structure checks

**What it checks:**
- ✅ Database connection
- ✅ ExpenseCategory table exists
- ✅ Expense.categoryId column exists
- ✅ Foreign key constraints exist
- ✅ Account codes are in correct range

**Usage:**
```bash
npm run validate:quick
# or
./scripts/quick-validation.sh
```

## Manual Testing Procedures

### Test 1: Historical Data Integrity

**Objective:** Verify no historical data was modified

**Steps:**
1. Count expenses before migration:
   ```sql
   SELECT COUNT(*) FROM "Expense" WHERE "isDeleted" = false;
   ```

2. Count expenses after migration:
   ```sql
   SELECT COUNT(*) FROM "Expense" WHERE "isDeleted" = false;
   ```
   ✅ Counts should match

3. Check sample expenses:
   ```sql
   SELECT id, description, amount, category, "expenseAccountId", "categoryId"
   FROM "Expense"
   WHERE "isDeleted" = false
   LIMIT 10;
   ```
   ✅ All fields should have original values
   ✅ `categoryId` may be NULL (backward compatible)

### Test 2: Reports Match General Ledger

**Objective:** Verify reports pull from TransactionLine (General Ledger)

**Steps:**

1. **Get expense total from General Ledger:**
   ```sql
   SELECT 
     SUM("debitAmount" - "creditAmount") as total_expenses
   FROM "TransactionLine" tl
   JOIN "Transaction" t ON tl."transactionId" = t.id
   JOIN "Account" a ON tl."accountId" = a.id
   WHERE a."accountType" = 'Expense'
     AND t."status" = 'posted'
     AND t."isReversal" = false
     AND t."date" >= '2026-01-01'
     AND t."date" <= '2026-02-12';
   ```

2. **Get expense total from Income Statement API:**
   ```bash
   curl "http://localhost:3000/api/reports/income-statement?startDate=2026-01-01&endDate=2026-02-12"
   ```
   ✅ Total expenses should match

3. **Verify expense breakdown by category:**
   ```bash
   curl "http://localhost:3000/api/reports/expense-analysis?startDate=2026-01-01&endDate=2026-02-12"
   ```
   ✅ Categories should match ExpenseCategory records

### Test 3: New Expense Category Creation

**Objective:** Verify automatic account code generation

**Steps:**

1. **Create a new category:**
   ```bash
   curl -X POST http://localhost:3000/api/expense-categories \
     -H "Content-Type: application/json" \
     -H "Cookie: your-session-cookie" \
     -d '{
       "name": "Marketing Expenses",
       "description": "All marketing related expenses"
     }'
   ```

2. **Verify response:**
   ✅ Category created with `id`, `name`, `accountCode`, `accountId`
   ✅ Account code is between 6000-6999
   ✅ Account is created in Chart of Accounts

3. **Verify in database:**
   ```sql
   SELECT ec.*, a."accountCode", a."accountName", a."accountType"
   FROM "ExpenseCategory" ec
   JOIN "Account" a ON ec."accountId" = a.id
   WHERE ec.name = 'Marketing Expenses';
   ```
   ✅ Account exists and is type 'Expense'
   ✅ Account code matches category's accountCode

### Test 4: Expense Creation with Category

**Objective:** Verify expenses link to categories correctly

**Steps:**

1. **Create expense using category name:**
   ```bash
   curl -X POST http://localhost:3000/api/expenses \
     -H "Content-Type: application/json" \
     -H "Cookie: your-session-cookie" \
     -d '{
       "description": "Facebook Ad Campaign",
       "amount": 500,
       "date": "2026-02-12",
       "category": "Marketing Expenses"
     }'
   ```

2. **Verify expense record:**
   ```sql
   SELECT id, description, amount, category, "categoryId", "expenseAccountId"
   FROM "Expense"
   WHERE description = 'Facebook Ad Campaign';
   ```
   ✅ `category` = "Marketing Expenses"
   ✅ `categoryId` is set (not NULL)
   ✅ `expenseAccountId` matches category's account

3. **Verify journal entry:**
   ```sql
   SELECT t.*, tl."accountId", tl."debitAmount", tl."creditAmount"
   FROM "Transaction" t
   JOIN "TransactionLine" tl ON t.id = tl."transactionId"
   WHERE t."sourceType" = 'Expense'
     AND t."sourceId" = '<expense-id>';
   ```
   ✅ Transaction exists with status 'posted'
   ✅ TransactionLine debits the expense account
   ✅ Account matches category's account

### Test 5: Backward Compatibility

**Objective:** Verify old expense creation method still works

**Steps:**

1. **Create expense with direct accountId (old way):**
   ```bash
   curl -X POST http://localhost:3000/api/expenses \
     -H "Content-Type: application/json" \
     -H "Cookie: your-session-cookie" \
     -d '{
       "description": "Office Supplies",
       "amount": 100,
       "date": "2026-02-12",
       "expenseAccountId": "<existing-account-id>"
     }'
   ```

2. **Verify expense record:**
   ```sql
   SELECT id, description, "categoryId", "expenseAccountId"
   FROM "Expense"
   WHERE description = 'Office Supplies';
   ```
   ✅ Expense created successfully
   ✅ `categoryId` is NULL (old method)
   ✅ `expenseAccountId` is set

3. **Verify journal entry created:**
   ✅ Transaction and TransactionLine created correctly
   ✅ Appears in reports correctly

### Test 6: User Testing

#### Existing User Test:
1. Login as existing user
2. Navigate to Expenses page
3. Create new expense category
4. Create expense using category
5. View Income Statement report
6. Verify all data appears correctly

#### New User Test:
1. Create new user account
2. Login as new user
3. Create expense category (should get account code 6000)
4. Create multiple categories (should get sequential codes)
5. Create expenses with categories
6. Verify reports show correct data

## Expected Results

### ✅ All Validations Should Pass:

1. **Historical Data:**
   - All expenses maintain original data
   - No data loss or corruption
   - Transaction lines intact

2. **Reports:**
   - Income Statement matches General Ledger
   - Expense totals are accurate
   - Categories appear in breakdowns

3. **New Features:**
   - Categories create accounts automatically
   - Account codes are in range 6000-6999
   - Expenses link to categories correctly

4. **Backward Compatibility:**
   - Old expense creation method works
   - Existing expenses unaffected
   - No breaking changes

## Troubleshooting

### Issue: Validation Script Fails

**Check:**
1. Database connection is working
2. Migration has been applied
3. Prisma client is generated: `npx prisma generate`

### Issue: Reports Don't Match General Ledger

**Check:**
1. Transactions are posted (status = 'posted')
2. Transaction lines have correct account references
3. Date ranges match
4. Reversals are excluded

### Issue: Category Creation Fails

**Check:**
1. User is authenticated
2. User has proper permissions
3. Account code range isn't exhausted (6000-6999)
4. Category name is unique for tenant

## Sign-off Checklist

Before marking as complete, verify:

- [ ] All validation scripts pass
- [ ] Manual tests pass
- [ ] Historical data is intact
- [ ] Reports match General Ledger
- [ ] New features work correctly
- [ ] Backward compatibility maintained
- [ ] Performance is acceptable
- [ ] No errors in production logs

## Next Steps

After validation passes:

1. ✅ Deploy to staging environment
2. ✅ Run validation scripts on staging
3. ✅ Perform user acceptance testing
4. ✅ Deploy to production
5. ✅ Monitor for issues
