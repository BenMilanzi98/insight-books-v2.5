-- Distinguish catalog rows (sync may update) from user-created custom units (never overwritten by sync).
ALTER TABLE "units" ADD COLUMN IF NOT EXISTS "isCatalogUnit" BOOLEAN NOT NULL DEFAULT false;
