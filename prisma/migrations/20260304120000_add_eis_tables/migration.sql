-- Add TPIN and EIS fields to Tenant
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "tpin" VARCHAR(20);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "eisEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Add EIS credential fields to TenantSettings
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "eisApiKey" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "eisClientSecret" TEXT;

-- EISInvoice table
CREATE TABLE IF NOT EXISTS "EISInvoice" (
    "id" VARCHAR(255) NOT NULL,
    "tenantId" VARCHAR(255) NOT NULL,
    "subscriptionId" VARCHAR(255),
    "invoiceNumber" VARCHAR(255) NOT NULL,
    "mraInvoiceId" VARCHAR(255),
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "taxAmount" DOUBLE PRECISION NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "submissionId" VARCHAR(255),
    "submittedAt" TIMESTAMP(3),
    "responseData" JSONB,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" TIMESTAMP(3),
    "sourceType" VARCHAR(50),
    "sourceId" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EISInvoice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EISInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EISInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "AccountSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "EISInvoice_tenantId_idx" ON "EISInvoice"("tenantId");
CREATE INDEX IF NOT EXISTS "EISInvoice_status_idx" ON "EISInvoice"("status");
CREATE INDEX IF NOT EXISTS "EISInvoice_invoiceNumber_idx" ON "EISInvoice"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "EISInvoice_submittedAt_idx" ON "EISInvoice"("submittedAt");
CREATE INDEX IF NOT EXISTS "EISInvoice_mraInvoiceId_idx" ON "EISInvoice"("mraInvoiceId");
CREATE INDEX IF NOT EXISTS "EISInvoice_sourceType_sourceId_idx" ON "EISInvoice"("sourceType", "sourceId");

-- EISConfiguration table
CREATE TABLE IF NOT EXISTS "EISConfiguration" (
    "id" VARCHAR(255) NOT NULL,
    "tenantId" VARCHAR(255) NOT NULL,
    "clientId" VARCHAR(255) NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "apiKey" VARCHAR(255),
    "environment" VARCHAR(50) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "syncStatus" VARCHAR(50),
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EISConfiguration_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EISConfiguration_tenantId_key" UNIQUE ("tenantId"),
    CONSTRAINT "EISConfiguration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "EISConfiguration_tenantId_idx" ON "EISConfiguration"("tenantId");
CREATE INDEX IF NOT EXISTS "EISConfiguration_environment_idx" ON "EISConfiguration"("environment");

-- EISSubmissionLog table
CREATE TABLE IF NOT EXISTS "EISSubmissionLog" (
    "id" VARCHAR(255) NOT NULL,
    "tenantId" VARCHAR(255) NOT NULL,
    "invoiceId" VARCHAR(255) NOT NULL,
    "requestPayload" JSONB NOT NULL,
    "responsePayload" JSONB,
    "status" VARCHAR(50) NOT NULL,
    "errorCode" VARCHAR(100),
    "errorMessage" TEXT,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EISSubmissionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EISSubmissionLog_tenantId_idx" ON "EISSubmissionLog"("tenantId");
CREATE INDEX IF NOT EXISTS "EISSubmissionLog_invoiceId_idx" ON "EISSubmissionLog"("invoiceId");
CREATE INDEX IF NOT EXISTS "EISSubmissionLog_createdAt_idx" ON "EISSubmissionLog"("createdAt");

-- EISUsage table
CREATE TABLE IF NOT EXISTS "EISUsage" (
    "id" VARCHAR(255) NOT NULL,
    "tenantId" VARCHAR(255) NOT NULL,
    "monthYear" VARCHAR(7) NOT NULL,
    "invoiceCount" INTEGER NOT NULL DEFAULT 0,
    "submissionCount" INTEGER NOT NULL DEFAULT 0,
    "approvedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EISUsage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EISUsage_tenantId_monthYear_key" UNIQUE ("tenantId", "monthYear"),
    CONSTRAINT "EISUsage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "EISUsage_tenantId_idx" ON "EISUsage"("tenantId");
CREATE INDEX IF NOT EXISTS "EISUsage_monthYear_idx" ON "EISUsage"("monthYear");
