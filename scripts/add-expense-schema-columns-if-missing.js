#!/usr/bin/env node
/**
 * Add Expense.taxTypeId and RecurringExpense.expenseAccountId if missing.
 * Safe to run multiple times (idempotent).
 * Run: node scripts/add-expense-schema-columns-if-missing.js
 */

const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config();

const prisma = new PrismaClient();

const statements = [
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
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set.');
    process.exit(1);
  }
  console.log('Adding missing expense / recurring-expense columns if not present...');
  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
    console.log('OK:', sql.trim().split('\n')[0].slice(0, 80));
  }
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
