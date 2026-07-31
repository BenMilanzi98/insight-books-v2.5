# Expense Categories Setup Guide

## Prerequisites

Before running validation scripts, you need to:

1. **Regenerate Prisma Client** (required after schema changes)
2. **Apply the Migration** (to create tables and columns)

## Step-by-Step Setup

### Step 1: Regenerate Prisma Client

After schema changes, Prisma client must be regenerated:

```bash
npx prisma generate
```

This reads your `prisma/schema.prisma` and generates the TypeScript/JavaScript client with the new `ExpenseCategory` model and `categoryId` field.

### Step 2: Apply the Migration

You have two options:

#### Option A: Use Prisma DB Push (Development - Recommended)

This syncs your schema directly without migration history:

```bash
npx prisma db push
```

**Pros:**
- Fast and simple
- No migration files to manage
- Perfect for development

**Cons:**
- No migration history
- Not recommended for production

#### Option B: Apply Migration File (Production Ready)

If you want to use the migration file we created:

```bash
# First, resolve any drift issues (if needed)
npx prisma migrate resolve --applied 20240204_add_reversal_fields

# Then apply the new migration
npx prisma migrate deploy
```

Or manually execute the SQL:

```bash
psql $DATABASE_URL -f prisma/migrations/20260212000000_add_expense_categories/migration.sql
```

### Step 3: Verify Setup

Run the quick validation:

```bash
npm run validate:quick
```

You should see:
- ✅ Database connection OK
- ✅ ExpenseCategory table exists
- ✅ Expense.categoryId column exists
- ✅ Foreign key constraints exist

## What Gets Created

After applying the migration:

1. **ExpenseCategory Table**
   - Stores expense categories
   - Links to Account in Chart of Accounts
   - Tracks account codes (6000-6999)

2. **Expense.categoryId Column**
   - Optional (nullable) field
   - Links expenses to ExpenseCategory
   - Backward compatible (existing expenses work)

3. **Foreign Key Constraints**
   - Expense.categoryId → ExpenseCategory.id
   - ExpenseCategory.accountId → Account.id
   - ExpenseCategory.tenantId → Tenant.id

## Troubleshooting

### Error: "Unknown field `categoryId`"

**Solution:** Regenerate Prisma client
```bash
npx prisma generate
```

### Error: "ExpenseCategory table does not exist"

**Solution:** Apply the migration
```bash
npx prisma db push
```

### Error: "Migration drift detected"

**Solution:** Resolve drift first
```bash
npx prisma migrate resolve --applied <migration-name>
npx prisma migrate deploy
```

## Validation After Setup

Once migration is applied and Prisma client is regenerated:

```bash
# Quick structure check
npm run validate:quick

# Full feature validation
npm run validate:expense-categories

# Data integrity check
npm run validate:data-integrity
```

All validations should pass! ✅
