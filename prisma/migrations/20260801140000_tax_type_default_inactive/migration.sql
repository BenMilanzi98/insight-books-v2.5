-- Tax codes are opt-in: default Inactive; force existing rows to Inactive.
ALTER TABLE "TaxType" ALTER COLUMN "status" SET DEFAULT 'Inactive';

UPDATE "TaxType"
SET "status" = 'Inactive'
WHERE "status" IS DISTINCT FROM 'Inactive';
