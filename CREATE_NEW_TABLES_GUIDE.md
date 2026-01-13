# Guide: Creating New HR/Payroll Tables on Production Server

## 🎯 Quick Command

```bash
# Run this on your production server
./scripts/create-hr-tables-production.sh
```

This script will:
1. ✅ Check your database state
2. ✅ Create a backup automatically
3. ✅ Create all new HR/Payroll tables safely
4. ✅ Generate Prisma client

## 📋 New Tables That Will Be Created

The following tables will be created (all **SAFE** - no data loss):

### Gratuity Management
- `GratuityAccount` - Tracks employee gratuity accrual
- `GratuityPayment` - Records gratuity payments

### Salary Advances
- `SalaryAdvance` - Tracks employee salary advances
- `AdvanceDeduction` - Records monthly deductions from payroll

### Leave Management
- `LeavePolicy` - Leave policy definitions
- `LeaveRequest` - Employee leave requests
- `LeaveBalance` - Employee leave balances

### Performance Management
- `PerformanceReview` - Performance review records
- `PerformanceReviewCriteria` - Review criteria and ratings
- `PerformanceGoal` - Employee performance goals
- `PerformanceFeedback` - 360-degree feedback

## 🚀 Step-by-Step Process

### Option 1: Using the Script (Recommended)

```bash
# 1. Run the script (it handles everything)
./scripts/create-hr-tables-production.sh

# 2. Restart your application
pm2 restart your-app
# or
systemctl restart your-service
```

### Option 2: Manual Commands

```bash
# 1. Backup first (MANDATORY!)
./scripts/backup-database.sh

# 2. Check migration status
npx prisma migrate status

# 3. If migrations exist, apply them
npx prisma migrate deploy

# 4. If no migrations exist, push schema directly
npx prisma db push --accept-data-loss=false

# 5. Generate Prisma client
npx prisma generate

# 6. Restart application
pm2 restart your-app
```

## ⚠️ Important Notes

### If You See "Drift Detected"

This means your database schema doesn't match your migration history. The script will give you two options:

**Option 1: Create Baseline (Recommended)**
- Do this if tables already exist in production
- Creates a migration that matches current state
- Run locally first, then apply to production

**Option 2: Push Schema Directly**
- Creates missing tables without migration files
- Faster but doesn't create migration history
- Still safe - only creates new tables

### Safety Guarantees

✅ **100% Safe Operations:**
- `CREATE TABLE` - Only creates new tables
- `CREATE INDEX` - Only creates indexes
- `ALTER TABLE ... ADD COLUMN` - Only adds new columns

❌ **No Dangerous Operations:**
- No `DROP TABLE` or `DROP COLUMN`
- No `DELETE FROM` statements
- No data modification

## 🔍 Verify Tables Were Created

After running the script, verify the tables exist:

```bash
# Option 1: Using Prisma Studio (visual)
npx prisma studio

# Option 2: Using psql
psql "$DATABASE_URL" -c "\dt" | grep -E "Gratuity|Salary|Leave|Performance"

# Option 3: Check via Prisma
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.\$queryRaw\`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%Gratuity%' OR table_name LIKE '%Leave%' OR table_name LIKE '%Performance%'\`.then(console.log)"
```

## 📝 What Happens During Execution

1. **Backup Created** - Automatic backup before any changes
2. **Schema Checked** - Verifies current database state
3. **Tables Created** - Creates all missing tables
4. **Indexes Created** - Creates necessary indexes
5. **Relations Created** - Sets up foreign keys
6. **Prisma Client Updated** - Generates new client with new models

## 🛠️ Troubleshooting

### Error: "Table already exists"
- Some tables may already exist
- The script will skip existing tables
- This is safe and expected

### Error: "Foreign key constraint failed"
- Make sure Employee table exists
- Make sure Tenant table exists
- These should already exist in your database

### Error: "Permission denied"
- Make sure database user has CREATE TABLE permissions
- Check your DATABASE_URL has correct credentials

## ✅ Success Checklist

After running, verify:

- [ ] Backup was created in `backups/` folder
- [ ] No errors during execution
- [ ] Tables visible in Prisma Studio or psql
- [ ] Application restarts without errors
- [ ] HR/Payroll features work correctly

## 🎉 You're Done!

Once the script completes successfully:
1. ✅ All new tables are created
2. ✅ Your existing data is safe
3. ✅ Application is ready to use new features

No data was lost - only new tables were added!

