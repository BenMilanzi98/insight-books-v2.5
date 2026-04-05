-- MobileAppConfig was added in schema without an earlier migration that created the table.
-- Create the full table when missing, then ensure websiteDownloadLocked exists (idempotent).

CREATE TABLE IF NOT EXISTS "MobileAppConfig" (
    "id" TEXT NOT NULL,
    "latestVersionCode" INTEGER NOT NULL DEFAULT 1,
    "latestVersionName" TEXT NOT NULL DEFAULT '1.0.0',
    "apkDownloadUrl" TEXT NOT NULL DEFAULT '',
    "releaseNotes" TEXT,
    "publishedAt" TIMESTAMP(3),
    "gracePeriodHours" INTEGER NOT NULL DEFAULT 24,
    "forceLock" BOOLEAN NOT NULL DEFAULT false,
    "websiteDownloadLocked" BOOLEAN NOT NULL DEFAULT false,
    "broadcastMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileAppConfig_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'MobileAppConfig'
    )
    AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'MobileAppConfig'
          AND column_name = 'websiteDownloadLocked'
    ) THEN
        ALTER TABLE "MobileAppConfig" ADD COLUMN "websiteDownloadLocked" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;
