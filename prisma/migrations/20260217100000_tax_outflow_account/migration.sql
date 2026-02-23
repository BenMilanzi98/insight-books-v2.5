-- AlterTable: TenantSettings - account where tax from outflows accumulates (for offset vs collected tax)
ALTER TABLE "TenantSettings" ADD COLUMN "taxOutflowAccountId" TEXT;
