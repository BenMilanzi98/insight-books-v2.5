-- AlterTable: main tenant (owner) has access to all branches; added users restricted by UserBranch
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;

CREATE INDEX IF NOT EXISTS "Tenant_ownerUserId_idx" ON "Tenant"("ownerUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Tenant_ownerUserId_fkey'
  ) THEN
    ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
