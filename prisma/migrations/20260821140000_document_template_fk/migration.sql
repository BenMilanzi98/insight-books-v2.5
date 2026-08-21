-- Per-document appearance override (Invoice / Quotation → InvoiceTemplate)
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "templateId" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "templateId" TEXT;

CREATE INDEX IF NOT EXISTS "Invoice_templateId_idx" ON "Invoice"("templateId");
CREATE INDEX IF NOT EXISTS "Quotation_templateId_idx" ON "Quotation"("templateId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_templateId_fkey'
  ) THEN
    ALTER TABLE "Invoice"
      ADD CONSTRAINT "Invoice_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "InvoiceTemplate"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Quotation_templateId_fkey'
  ) THEN
    ALTER TABLE "Quotation"
      ADD CONSTRAINT "Quotation_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "InvoiceTemplate"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;