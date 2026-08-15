CREATE TABLE "DesktopDevice" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "numberPrefix" TEXT NOT NULL,
  "boundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unboundAt" TIMESTAMP(3),
  "lastHeartbeatAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DesktopDevice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DesktopDevice_deviceId_key" ON "DesktopDevice"("deviceId");
CREATE INDEX "DesktopDevice_tenantId_unboundAt_idx" ON "DesktopDevice"("tenantId", "unboundAt");
CREATE INDEX "DesktopDevice_tenantId_numberPrefix_idx" ON "DesktopDevice"("tenantId", "numberPrefix");
ALTER TABLE "DesktopDevice" ADD CONSTRAINT "DesktopDevice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DesktopOutboxReceipt" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "serverEntityId" TEXT,
  "resultJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DesktopOutboxReceipt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DesktopOutboxReceipt_tenantId_id_key" ON "DesktopOutboxReceipt"("tenantId", "id");
CREATE INDEX "DesktopOutboxReceipt_tenantId_idx" ON "DesktopOutboxReceipt"("tenantId");
ALTER TABLE "DesktopOutboxReceipt" ADD CONSTRAINT "DesktopOutboxReceipt_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "DesktopDevice"("deviceId") ON DELETE CASCADE ON UPDATE CASCADE;
