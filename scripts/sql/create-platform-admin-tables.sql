-- Additive only. Safe to re-run. Fixes admin dashboard/billing 500s when tables are missing.

CREATE TABLE IF NOT EXISTS "PlatformSupportAccess" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "endReason" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformSupportAccess_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PlatformSupportAccess_adminId_idx" ON "PlatformSupportAccess"("adminId");
CREATE INDEX IF NOT EXISTS "PlatformSupportAccess_tenantId_idx" ON "PlatformSupportAccess"("tenantId");
CREATE INDEX IF NOT EXISTS "PlatformSupportAccess_status_idx" ON "PlatformSupportAccess"("status");

CREATE TABLE IF NOT EXISTS "PlatformInvoice" (
  "id" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "currency" TEXT NOT NULL DEFAULT 'MWK',
  "subtotal" DECIMAL(18,2) NOT NULL,
  "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "tax" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(18,2) NOT NULL,
  "amountPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "outstanding" DECIMAL(18,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformInvoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformInvoice_invoiceNumber_key" ON "PlatformInvoice"("invoiceNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformInvoice_idempotencyKey_key" ON "PlatformInvoice"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "PlatformInvoice_tenantId_idx" ON "PlatformInvoice"("tenantId");
CREATE INDEX IF NOT EXISTS "PlatformInvoice_status_idx" ON "PlatformInvoice"("status");

CREATE TABLE IF NOT EXISTS "PlatformPayment" (
  "id" TEXT NOT NULL,
  "paymentNumber" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "invoiceId" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'MWK',
  "amount" DECIMAL(18,2) NOT NULL,
  "method" TEXT,
  "gateway" TEXT,
  "gatewayReference" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformPayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformPayment_paymentNumber_key" ON "PlatformPayment"("paymentNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformPayment_idempotencyKey_key" ON "PlatformPayment"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "PlatformPayment_tenantId_idx" ON "PlatformPayment"("tenantId");
CREATE INDEX IF NOT EXISTS "PlatformPayment_invoiceId_idx" ON "PlatformPayment"("invoiceId");

CREATE TABLE IF NOT EXISTS "PlatformCredit" (
  "id" TEXT NOT NULL,
  "creditNumber" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "invoiceId" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'MWK',
  "amount" DECIMAL(18,2) NOT NULL,
  "remaining" DECIMAL(18,2) NOT NULL,
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" TEXT,
  CONSTRAINT "PlatformCredit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformCredit_creditNumber_key" ON "PlatformCredit"("creditNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformCredit_idempotencyKey_key" ON "PlatformCredit"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "PlatformCredit_tenantId_idx" ON "PlatformCredit"("tenantId");
CREATE INDEX IF NOT EXISTS "PlatformCredit_status_idx" ON "PlatformCredit"("status");

CREATE TABLE IF NOT EXISTS "PlatformRefund" (
  "id" TEXT NOT NULL,
  "refundNumber" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "invoiceId" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'MWK',
  "amount" DECIMAL(18,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "reason" TEXT,
  "gatewayReference" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdBy" TEXT,
  CONSTRAINT "PlatformRefund_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformRefund_refundNumber_key" ON "PlatformRefund"("refundNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformRefund_idempotencyKey_key" ON "PlatformRefund"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "PlatformRefund_tenantId_idx" ON "PlatformRefund"("tenantId");
CREATE INDEX IF NOT EXISTS "PlatformRefund_paymentId_idx" ON "PlatformRefund"("paymentId");
CREATE INDEX IF NOT EXISTS "PlatformRefund_status_idx" ON "PlatformRefund"("status");
