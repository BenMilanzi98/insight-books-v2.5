# Database Migration Commands

## 🚀 Quick Commands to Create New Tables

### Option 1: Using npm script (Recommended)
```bash
npm run db:migrate:production
```

This command will:
1. ✅ Push schema to database (creates new tables)
2. ✅ Generate Prisma client
3. ✅ Safe - only creates tables, never deletes data

### Option 2: Using npx directly
```bash
npx prisma db push --accept-data-loss=false && npx prisma generate
```

### Option 3: If you have migration files
```bash
npm run db:migrate:deploy
# or
npx prisma migrate deploy
```

## 📋 Available Database Commands

| Command | Description | Use Case |
|---------|-------------|----------|
| `npm run db:migrate:production` | Push schema + generate client | **Production - Create new tables** |
| `npm run db:migrate:deploy` | Apply pending migrations | Production - Apply migration files |
| `npm run db:migrate` | Create & apply migration | Development only |
| `npm run db:push` | Push schema directly | Development - Quick sync |
| `npm run db:generate` | Generate Prisma client | After schema changes |
| `npm run db:studio` | Open Prisma Studio | View/edit database |

## 🎯 For Your Current Situation

Since you need to create new HR/Payroll tables on production, run:

```bash
npm run db:migrate:production
```

Then restart your application:
```bash
pm2 restart your-app
# or
systemctl restart your-service
```

## ⚠️ Important Notes

- **`db:migrate:production`** is safe - only creates new tables
- **`db:migrate:deploy`** requires migration files to exist
- **`db:migrate`** is for development only (creates migration files)
- Always restart your app after running migrations

## 🔍 Verify Migration Success

After running the command, verify tables were created:

```bash
# Option 1: Using Prisma Studio
npm run db:studio

# Option 2: Check via psql
psql "$DATABASE_URL" -c "\dt" | grep -E "Leave|Gratuity|Salary|Performance"
```

## ✅ What Gets Created

The migration will create these new tables:
- `LeavePolicy`, `LeaveRequest`, `LeaveBalance`
- `GratuityAccount`, `GratuityPayment`
- `SalaryAdvance`, `AdvanceDeduction`
- `PerformanceReview`, `PerformanceReviewCriteria`
- `PerformanceGoal`, `PerformanceFeedback`

