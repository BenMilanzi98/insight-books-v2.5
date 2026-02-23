-- AlterTable: TenantSettings - tax account where outflow tax accumulates (for offset vs collected tax)
ALTER TABLE "TenantSettings" ADD COLUMN "taxOutflowAccountId" TEXT;
