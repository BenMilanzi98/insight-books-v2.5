-- Default tax flow: add default account for tax collected (inflow from sales/invoices)
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "taxInflowAccountId" TEXT;
