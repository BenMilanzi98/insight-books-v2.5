-- AlterTable
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "glAccountId" TEXT;

-- AlterTable
ALTER TABLE "Liability" ADD COLUMN IF NOT EXISTS "glAccountId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Asset_glAccountId_idx" ON "Asset"("glAccountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Liability_glAccountId_idx" ON "Liability"("glAccountId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Asset_glAccountId_fkey'
  ) THEN
    ALTER TABLE "Asset"
      ADD CONSTRAINT "Asset_glAccountId_fkey"
      FOREIGN KEY ("glAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Liability_glAccountId_fkey'
  ) THEN
    ALTER TABLE "Liability"
      ADD CONSTRAINT "Liability_glAccountId_fkey"
      FOREIGN KEY ("glAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
