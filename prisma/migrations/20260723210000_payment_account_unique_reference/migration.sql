-- Allow duplicate payment account names per tenant; uniqueness moves to account number (reference).
-- PostgreSQL UNIQUE treats NULL as distinct, so system Cash (null reference) remains valid.

DROP INDEX IF EXISTS "PaymentAccount_tenantId_name_key";

-- Normalize blank references to NULL so empty strings do not collide incorrectly.
UPDATE "PaymentAccount"
SET "reference" = NULL
WHERE "reference" IS NOT NULL AND BTRIM("reference") = '';

-- Fail migration early if duplicate non-null references already exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "PaymentAccount"
    WHERE "reference" IS NOT NULL
    GROUP BY "tenantId", "reference"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot apply PaymentAccount unique(reference): duplicate tenantId+reference rows exist. Resolve duplicates before migrating.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentAccount_tenantId_reference_key"
  ON "PaymentAccount"("tenantId", "reference");

CREATE INDEX IF NOT EXISTS "PaymentAccount_tenantId_name_idx"
  ON "PaymentAccount"("tenantId", "name");
