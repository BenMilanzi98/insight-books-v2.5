-- AlterTable
ALTER TABLE "JournalEntry" ALTER COLUMN "status" SET DEFAULT 'draft';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "reference" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'draft';
