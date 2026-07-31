-- Thermal receipt paper width preference (58–90 mm). Default keeps existing 80 mm behavior.
ALTER TABLE "TenantSettings"
ADD COLUMN IF NOT EXISTS "receiptPaperWidthMm" INTEGER NOT NULL DEFAULT 80;
