-- English / Chichewa preference fields (non-destructive)
ALTER TABLE "TenantSettings"
  ADD COLUMN IF NOT EXISTS "defaultLanguage" TEXT NOT NULL DEFAULT 'en';

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "preferredLanguage" TEXT;
