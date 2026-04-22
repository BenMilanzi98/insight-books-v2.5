-- Maintenance lock + anonymous mobile client telemetry

ALTER TABLE "MobileAppConfig" ADD COLUMN IF NOT EXISTS "maintenanceLock" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MobileAppConfig" ADD COLUMN IF NOT EXISTS "maintenanceMessage" TEXT;

CREATE TABLE IF NOT EXISTS "MobileAppClientEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventType" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "versionCode" INTEGER NOT NULL,
    "versionName" TEXT,
    "targetVersionCode" INTEGER,
    "bytesReceived" INTEGER,
    "bytesTotal" INTEGER,
    "error" TEXT,
    "meta" JSONB,

    CONSTRAINT "MobileAppClientEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MobileAppClientEvent_createdAt_idx" ON "MobileAppClientEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "MobileAppClientEvent_eventType_createdAt_idx" ON "MobileAppClientEvent"("eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "MobileAppClientEvent_deviceId_createdAt_idx" ON "MobileAppClientEvent"("deviceId", "createdAt");
