/*
  Warnings:

  - Made the column `status` on table `JournalEntry` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "status" SET NOT NULL;
