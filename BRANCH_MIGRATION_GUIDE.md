# Branch System - Data Migration Guide

## Overview

This guide explains how the branch system handles existing data that was created before branches were implemented.

## How Existing Data is Handled

### 1. **Backward Compatibility (Default Behavior)**

By default, the system shows **both**:
- Records with the selected branch (`branchId = selectedBranchId`)
- Records with no branch (`branchId = null`) - existing data

This ensures:
- ✅ Existing data remains visible
- ✅ No data loss
- ✅ Smooth transition period

**Example:** If you select "Branch A", the dashboard shows:
- All sales/expenses/invoices for Branch A
- **Plus** all sales/expenses/invoices with `branchId = null` (old data)

### 2. **Migration Tool**

To assign existing data to branches:

1. **Go to:** `/branches/migrate`
2. **Preview:** See how many records need migration
3. **Choose option:**
   - **My Default Branch**: Assigns all null records to your user's default branch
   - **Specific Branch**: Assigns all null records to a branch you select
4. **Migrate:** Click "Migrate Records" to assign them

### 3. **What Gets Migrated**

The migration tool assigns `branchId` to:
- ✅ Sales
- ✅ Invoices  
- ✅ Expenses
- ✅ Payments
- ✅ Products (inventory)
- ✅ Transactions
- ✅ Journal Entries

**Note:** Only records with `branchId = null` are migrated. Records already assigned to branches are not changed.

## Dashboard Behavior

### When a Branch is Selected:
- Shows data for that branch **+** existing data (null branchId)
- This allows you to see both new branch-specific data and historical data

### When "All Branches" is Selected:
- Shows data from all branches **+** existing data (null branchId)
- Useful for consolidated views

## Best Practices

1. **Create branches first** before migrating data
2. **Set a default branch** for your user (User Management → Edit User)
3. **Migrate existing data** using `/branches/migrate` when ready
4. **After migration**, the dashboard will show only branch-specific data when a branch is selected

## Technical Details

### Branch Filtering Logic

The `addBranchFilter()` helper function:
```javascript
// When branch is selected:
where.OR = [
  { branchId: selectedBranchId },
  { branchId: null }  // Include existing data
]

// When no branch selected:
// No branch filter (shows all data)
```

This ensures backward compatibility while allowing branch-specific views.

## Migration API

**GET** `/api/branches/migrate-data`
- Preview: Shows counts of records needing migration

**POST** `/api/branches/migrate-data`
- Body: `{ branchId?: string, assignTo: 'default' | 'specific' }`
- Migrates all null `branchId` records to the specified branch


