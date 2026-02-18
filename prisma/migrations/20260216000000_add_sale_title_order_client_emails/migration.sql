-- Add columns for Sale title/orderNumber, Client additionalEmails, Invoice/Quotation title/orderNumber
-- Safe: ADD COLUMN IF NOT EXISTS - no data loss

-- Sale: title and orderNumber (nullable)
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "orderNumber" TEXT;

-- Client: additionalEmails for multiple invoice recipients
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "additionalEmails" TEXT[] DEFAULT '{}';

-- Invoice: title and orderNumber (nullable)
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "orderNumber" TEXT;

-- Quotation: orderNumber (nullable; title may already exist)
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "orderNumber" TEXT;
-- Quotation.title might be required in schema; add only if missing
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "title" TEXT;
