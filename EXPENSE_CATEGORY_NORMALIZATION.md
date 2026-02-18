# Expense Category Normalization

## Overview

This feature silently normalizes expense categories to account codes in the backend without disrupting existing users. It ensures:

- ✅ All existing categories remain visible to users
- ✅ Duplicate categories automatically map to standard Chart of Accounts codes
- ✅ Historical transactions remain unchanged
- ✅ Reports use account codes for grouping (normalized)

## How It Works

### 1. Silent Backend Normalization

When an expense is created or updated, the system automatically:

1. **Checks for existing account**: If `expenseAccountId` is provided, uses that account
2. **Normalizes category name**: Maps the category to a standard account code using:
   - Standard category mappings (e.g., "office supplies" → 6001)
   - Fuzzy matching for similar categories
   - Automatic account code generation (6000-6999 range) for new categories
3. **Creates account if needed**: Automatically creates Chart of Accounts entry
4. **Links expense to account**: Sets `expenseAccountId` silently

### 2. Category Mapping

The system uses a standard mapping table for common categories:

| Category | Account Code | Account Name |
|----------|--------------|--------------|
| Office Supplies, Stationery | 6001 | Office Supplies |
| Utilities, Electricity, Water, Internet | 6002 | Utilities |
| Rent, Rental, Office Rent | 6003 | Rent Expense |
| Insurance | 6004 | Insurance Expense |
| Professional Fees, Legal, Accounting | 6005 | Professional Fees |
| Bank Charges, Bank Fees | 6006 | Bank Charges |
| Travel, Transportation | 6101 | Travel & Transportation |
| Fuel, Petrol, Gas | 6102 | Fuel Expense |
| Marketing, Advertising | 6201 | Marketing & Advertising |
| Salaries, Wages, Payroll | 6301 | Salaries & Wages |
| Training, Education | 6401 | Training & Development |
| Maintenance, Repairs | 6501 | Maintenance & Repairs |
| Miscellaneous, Other | 6901 | Miscellaneous Expenses |

### 3. Duplicate Category Handling

Duplicate categories (e.g., "Office Supplies", "office supplies", "Office Supplies & Stationery") automatically map to the same account code (6001), ensuring consistent reporting.

### 4. Reporting

Reports group expenses by **account code** (not category name), ensuring:

- Consistent grouping across all reports
- Duplicate categories are consolidated
- Standard Chart of Accounts structure

However, the original category name is still visible in:
- Expense details
- Transaction history
- User interface

## Implementation

### Files Modified

1. **`lib/expenseCategoryNormalization.js`** (New)
   - Core normalization service
   - Category-to-account-code mapping
   - Account creation logic

2. **`app/api/expenses/route.js`**
   - Updated to use normalization service
   - Silent account assignment

3. **`lib/incomeStatementService.js`**
   - Updated to group by account code
   - Maintains category names for display

4. **`app/api/reports/expense-analysis/route.js`**
   - Updated to group by account code
   - Shows category names alongside account codes

### Migration Script

Run the normalization script to normalize existing expenses:

```bash
npm run normalize:expenses
```

This script:
- Processes all tenants
- Maps existing categories to account codes
- Creates accounts for unmapped categories
- Updates `expenseAccountId` for all expenses
- Shows mapping summary

## Usage

### Creating Expenses

No changes required! The normalization happens automatically:

```javascript
// User creates expense with category "Office Supplies"
POST /api/expenses
{
  "category": "Office Supplies",
  "amount": 100,
  ...
}

// System automatically:
// 1. Maps "Office Supplies" → Account Code 6001
// 2. Creates/uses account "Office Supplies" (6001)
// 3. Sets expenseAccountId
// 4. Category name remains "Office Supplies" (visible to user)
```

### Viewing Reports

Reports automatically group by account code:

```javascript
// Income Statement groups by account code
{
  "accountCode": "6001",
  "accountName": "Office Supplies",
  "category": "Office Supplies, Stationery", // All categories mapped to this code
  "amount": 500
}
```

## Benefits

1. **No User Disruption**: All existing categories remain visible
2. **Consistent Reporting**: Duplicate categories consolidated automatically
3. **Standard Structure**: Follows Chart of Accounts best practices
4. **Backward Compatible**: Historical transactions unchanged
5. **Automatic**: No manual intervention required

## Standard Account Code Ranges

- **6000-6099**: Office & Administrative
- **6100-6199**: Travel & Transportation
- **6200-6299**: Marketing & Advertising
- **6300-6399**: Salaries & Wages
- **6400-6499**: Training & Development
- **6500-6599**: Maintenance & Repairs
- **6900-6999**: Miscellaneous

## Troubleshooting

### Category Not Mapping Correctly

If a category doesn't map to the expected account code:

1. Check the standard mappings in `lib/expenseCategoryNormalization.js`
2. Add custom mapping if needed
3. Run normalization script to update existing expenses

### Account Code Range Exhausted

If the 6000-6999 range is exhausted:

1. The system will find gaps in the range
2. If no gaps, an error will be thrown
3. Consider expanding the range or consolidating categories

### Reports Showing Duplicate Categories

If reports show duplicate categories:

1. Run normalization script: `npm run normalize:expenses`
2. Verify expenses have `expenseAccountId` set
3. Check that reports are grouping by account code

## Future Enhancements

- [ ] User-configurable category mappings
- [ ] Category hierarchy support
- [ ] Bulk category normalization UI
- [ ] Category mapping import/export
