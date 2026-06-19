#!/usr/bin/env node
/**
 * Idempotent schema backfill for deployments where migrations were skipped.
 * Run: node scripts/sync-deployment-schema-gaps.js
 */

const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config();

const prisma = new PrismaClient();

const statements = [
  // Expense.taxTypeId
  `ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "taxTypeId" TEXT`,
  `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Expense_taxTypeId_fkey') THEN
    ALTER TABLE "Expense" ADD CONSTRAINT "Expense_taxTypeId_fkey"
      FOREIGN KEY ("taxTypeId") REFERENCES "TaxType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
`,
  `CREATE INDEX IF NOT EXISTS "Expense_taxTypeId_idx" ON "Expense"("taxTypeId")`,

  // RecurringExpense.expenseAccountId
  `ALTER TABLE "RecurringExpense" ADD COLUMN IF NOT EXISTS "expenseAccountId" TEXT`,
  `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RecurringExpense_expenseAccountId_fkey') THEN
    ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_expenseAccountId_fkey"
      FOREIGN KEY ("expenseAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
`,
  `CREATE INDEX IF NOT EXISTS "RecurringExpense_expenseAccountId_idx" ON "RecurringExpense"("expenseAccountId")`,

  // Budget.budgetType
  `ALTER TABLE "Budget" ADD COLUMN IF NOT EXISTS "budgetType" TEXT NOT NULL DEFAULT 'revenue'`,
  `CREATE INDEX IF NOT EXISTS "Budget_budgetType_idx" ON "Budget"("budgetType")`,

  // AccountingPeriod table
  `
CREATE TABLE IF NOT EXISTS "AccountingPeriod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenedById" TEXT,
    "reopenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);
`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "AccountingPeriod_tenantId_periodType_startDate_key"
    ON "AccountingPeriod"("tenantId", "periodType", "startDate")`,
  `CREATE INDEX IF NOT EXISTS "AccountingPeriod_tenantId_idx" ON "AccountingPeriod"("tenantId")`,
  `CREATE INDEX IF NOT EXISTS "AccountingPeriod_startDate_endDate_idx" ON "AccountingPeriod"("startDate", "endDate")`,
  `CREATE INDEX IF NOT EXISTS "AccountingPeriod_status_idx" ON "AccountingPeriod"("status")`,
  `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AccountingPeriod_tenantId_fkey') THEN
    ALTER TABLE "AccountingPeriod"
      ADD CONSTRAINT "AccountingPeriod_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AccountingPeriod_closedById_fkey') THEN
    ALTER TABLE "AccountingPeriod"
      ADD CONSTRAINT "AccountingPeriod_closedById_fkey"
      FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AccountingPeriod_reopenedById_fkey') THEN
    ALTER TABLE "AccountingPeriod"
      ADD CONSTRAINT "AccountingPeriod_reopenedById_fkey"
      FOREIGN KEY ("reopenedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
`,

  // InvoiceItem.accountId (per-line revenue GL)
  `ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "accountId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "InvoiceItem_accountId_idx" ON "InvoiceItem"("accountId")`,
  `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceItem_accountId_fkey') THEN
    ALTER TABLE "InvoiceItem"
      ADD CONSTRAINT "InvoiceItem_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
`,
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set.');
    process.exit(1);
  }
  console.log('Syncing deployment schema gaps...');
  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
    console.log('OK:', sql.trim().split('\n')[0].slice(0, 90));
  }
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
