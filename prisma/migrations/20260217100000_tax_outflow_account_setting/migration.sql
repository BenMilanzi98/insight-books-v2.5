-- AlterTable: TenantSettings - tax account where outflow tax accumulates (for offset vs collected tax)
-- Idempotent: column may already exist from 20260217100000_tax_outflow_account
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "taxOutflowAccountId" TEXT;
