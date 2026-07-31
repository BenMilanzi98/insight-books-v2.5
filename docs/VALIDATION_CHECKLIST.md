# Expense Categories - Validation Checklist

## Pre-Migration Validation

### ✅ Schema Validation
- [ ] ExpenseCategory model exists in schema
- [ ] Expense.categoryId field is nullable (backward compatible)
- [ ] All foreign key relationships are defined
- [ ] Unique constraints are in place

### ✅ Migration File Validation
- [ ] Migration uses `IF NOT EXISTS` for safety
- [ ] Migration uses `ADD COLUMN IF NOT EXISTS` for safety
- [ ] No data deletion or modification in migration
- [ ] Foreign keys use appropriate ON DELETE actions

## Post-Migration Validation

### 1. Historical Data Integrity

#### Run Validation Script:
```bash
node scripts/validate-expense-categories.js
```

#### Manual Checks:
- [ ] All existing expenses still have `category` field
- [ ] All existing expenses still have `expenseAccountId`
- [ ] No expenses were deleted or modified
- [ ] Transaction lines are intact
- [ ] All transaction lines have valid account references

#### Expected Results:
- ✅ All expenses maintain their original data
- ✅ `categoryId` is optional (nullable) - existing expenses may not have it
- ✅ Both old and new expense creation methods work

### 2. Expense Categories Feature

#### Test Category Creation:
```bash
# Via API
curl -X POST http://localhost:3000/api/expense-categories \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Category",
    "description": "Test description"
  }'
```

#### Verify:
- [ ] Category is created successfully
- [ ] Account is automatically created in Chart of Accounts
- [ ] Account code is in range 6000-6999
- [ ] Account type is "Expense"
- [ ] Account is linked to category

#### Test Expense Creation with Category:
```bash
# Create expense using category name
curl -X POST http://localhost:3000/api/expenses \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Test Expense",
    "amount": 100,
    "date": "2026-02-12",
    "category": "Test Category"
  }'
```

#### Verify:
- [ ] Expense is created successfully
- [ ] Expense has `categoryId` set
- [ ] Expense has `expenseAccountId` set to category's account
- [ ] Journal entry is created correctly
- [ ] Transaction lines are posted to correct account

### 3. Reports Validation

#### Test Income Statement:
```bash
# Generate income statement
curl "http://localhost:3000/api/reports/income-statement?startDate=2026-01-01&endDate=2026-02-12"
```

#### Verify:
- [ ] Report generates without errors
- [ ] Expenses are calculated from General Ledger (TransactionLine)
- [ ] Expense totals match TransactionLine calculations
- [ ] Categories appear correctly in expense breakdown
- [ ] Account codes are displayed correctly

#### Test Balance Sheet:
```bash
curl "http://localhost:3000/api/reports/balance-sheet?asOfDate=2026-02-12"
```

#### Verify:
- [ ] Report generates without errors
- [ ] Account balances are accurate
- [ ] Expense accounts are not included (correct - they're on Income Statement)

#### Test Budget Reports:
```bash
curl "http://localhost:3000/api/budgets/reports?type=summary"
```

#### Verify:
- [ ] Budget vs actual calculations work
- [ ] Expense categories are included in budget tracking
- [ ] Actual expenses pull from General Ledger

### 4. Backward Compatibility

#### Test Old Expense Creation Method:
```bash
# Create expense with direct accountId (old way)
curl -X POST http://localhost:3000/api/expenses \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Old Method Expense",
    "amount": 200,
    "date": "2026-02-12",
    "expenseAccountId": "<account-id>"
  }'
```

#### Verify:
- [ ] Expense is created successfully
- [ ] Works without ExpenseCategory
- [ ] Journal entry is created correctly
- [ ] Appears in reports correctly

### 5. Data Integrity

#### Run Integrity Script:
```bash
node scripts/validate-data-integrity.js
```

#### Verify:
- [ ] All foreign key relationships are valid
- [ ] No orphaned records exist
- [ ] Account balances are consistent
- [ ] Transaction integrity is maintained

### 6. User Testing

#### Test with Existing User:
- [ ] Existing user can view expense categories
- [ ] Existing user can create new categories
- [ ] Existing user can create expenses with categories
- [ ] Existing user's historical expenses are intact

#### Test with New User:
- [ ] New user can view expense categories
- [ ] New user can create new categories
- [ ] New user can create expenses with categories
- [ ] New user's categories get correct account codes

## Regression Tests

### Critical Paths to Test:

1. **Expense Creation Flow:**
   - [ ] Create expense with category name → Verify categoryId set
   - [ ] Create expense with accountId → Verify works (backward compat)
   - [ ] Create expense with both → Verify categoryId takes precedence

2. **Category Management:**
   - [ ] Create category → Verify account created
   - [ ] Create duplicate category name → Verify error
   - [ ] View categories → Verify account info displayed

3. **Reporting:**
   - [ ] Income Statement → Verify expenses from GL
   - [ ] Expense Analysis → Verify category breakdown
   - [ ] Budget Reports → Verify category tracking

4. **Data Integrity:**
   - [ ] Delete category → Verify expenses still work
   - [ ] Deactivate account → Verify category still accessible
   - [ ] Historical data → Verify unchanged

## Performance Validation

- [ ] Category creation completes in < 2 seconds
- [ ] Expense creation with category completes in < 3 seconds
- [ ] Reports generate in reasonable time (< 10 seconds)
- [ ] No N+1 query issues in category listings

## Security Validation

- [ ] Users can only access their tenant's categories
- [ ] Category creation requires authentication
- [ ] Account creation is restricted to system
- [ ] No SQL injection vulnerabilities

## Rollback Plan

If issues are found:

1. **Immediate Rollback:**
   ```sql
   -- Remove foreign key constraints
   ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_categoryId_fkey";
   ALTER TABLE "ExpenseCategory" DROP CONSTRAINT IF EXISTS "ExpenseCategory_accountId_fkey";
   ALTER TABLE "ExpenseCategory" DROP CONSTRAINT IF EXISTS "ExpenseCategory_tenantId_fkey";
   
   -- Drop column (optional - can keep for future)
   ALTER TABLE "Expense" DROP COLUMN IF EXISTS "categoryId";
   
   -- Drop table
   DROP TABLE IF EXISTS "ExpenseCategory";
   ```

2. **Code Rollback:**
   - Revert API changes
   - Revert schema changes
   - Deploy previous version

## Success Criteria

✅ All validation scripts pass  
✅ All manual tests pass  
✅ No data loss or corruption  
✅ Reports match General Ledger  
✅ Backward compatibility maintained  
✅ Performance is acceptable  
✅ Security is maintained  

## Sign-off

- [ ] Development Team: _________________ Date: _______
- [ ] QA Team: _________________ Date: _______
- [ ] Product Owner: _________________ Date: _______
