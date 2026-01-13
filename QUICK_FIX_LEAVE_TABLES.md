# Quick Fix: Create Leave Management Tables

## 🚨 Problem
You're getting 500 errors on `/api/leave-policies` and `/api/leave-requests` because the tables don't exist in production.

## ✅ Solution: Run This Command on Your Production Server

```bash
# Option 1: Using the automated script (RECOMMENDED)
./scripts/create-hr-tables-production.sh

# Option 2: Quick manual command
npx prisma db push --accept-data-loss=false && npx prisma generate
```

## 📋 What This Will Create

The following tables will be created:
- ✅ `LeavePolicy` - Leave policy definitions
- ✅ `LeaveRequest` - Employee leave requests  
- ✅ `LeaveBalance` - Employee leave balances
- ✅ `GratuityAccount` & `GratuityPayment` - Gratuity management
- ✅ `SalaryAdvance` & `AdvanceDeduction` - Salary advances
- ✅ `PerformanceReview`, `PerformanceReviewCriteria` - Performance reviews
- ✅ `PerformanceGoal` - Performance goals
- ✅ `PerformanceFeedback` - 360-degree feedback

## ⚡ Quick Steps

1. **SSH into your production server**
2. **Navigate to your project directory**
3. **Run the command:**
   ```bash
   npx prisma db push --accept-data-loss=false
   npx prisma generate
   ```
4. **Restart your application:**
   ```bash
   pm2 restart your-app
   # or
   systemctl restart your-service
   ```

## 🔍 Verify It Worked

After running, check your server logs or try accessing:
- https://insightbooksafrica.com/hr/leave

The errors should be gone!

## ⚠️ Important Notes

- **Safe Operation**: `db push` only creates new tables, never deletes data
- **No Backup Needed**: Since we're only creating tables, existing data is safe
- **Fast**: Takes only a few seconds to complete

