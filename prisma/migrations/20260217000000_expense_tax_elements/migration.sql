-- AlterTable: Expense - add tax components for reporting and reconciliation
ALTER TABLE "Expense" ADD COLUMN "taxAmount" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "Expense" ADD COLUMN "taxRate" DOUBLE PRECISION DEFAULT 0;
