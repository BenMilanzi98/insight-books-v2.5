-- Additive platform control-plane tables (admin billing / support).
-- Safe for production: CREATE IF NOT EXISTS only — no drops, no ReversalAudit changes.

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

CREATE TABLE IF NOT EXISTS "PlatformGlobalSettings" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "PlatformGlobalSettings_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformInvoice_subscriptionId_periodStart_periodEnd_key"
  ON "PlatformInvoice"("subscriptionId", "periodStart", "periodEnd");
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
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformPayment_gateway_gatewayReference_key"
  ON "PlatformPayment"("gateway", "gatewayReference");
CREATE INDEX IF NOT EXISTS "PlatformPayment_tenantId_idx" ON "PlatformPayment"("tenantId");
CREATE INDEX IF NOT EXISTS "PlatformPayment_invoiceId_idx" ON "PlatformPayment"("invoiceId");

CREATE TABLE IF NOT EXISTS "PlatformPlanVersion" (
    "id" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "publicName" TEXT,
    "description" TEXT,
    "planCategory" TEXT NOT NULL DEFAULT 'CORE',
    "productCode" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "basePrice" DECIMAL(18,2) NOT NULL,
    "billingFrequency" TEXT NOT NULL DEFAULT 'month',
    "userLimit" INTEGER,
    "businessLimit" INTEGER,
    "featuresJson" JSONB NOT NULL DEFAULT '[]',
    "limitsJson" JSONB NOT NULL DEFAULT '{}',
    "eligibilityJson" JSONB NOT NULL DEFAULT '{}',
    "billingCyclesJson" JSONB NOT NULL DEFAULT '[]',
    "presentationJson" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "trialEnabled" BOOLEAN NOT NULL DEFAULT false,
    "trialDays" INTEGER,
    "ctaText" TEXT,
    "highlightText" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    CONSTRAINT "PlatformPlanVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformPlanVersion_planCode_version_key"
  ON "PlatformPlanVersion"("planCode", "version");
CREATE INDEX IF NOT EXISTS "PlatformPlanVersion_planCode_idx" ON "PlatformPlanVersion"("planCode");
CREATE INDEX IF NOT EXISTS "PlatformPlanVersion_status_idx" ON "PlatformPlanVersion"("status");
CREATE INDEX IF NOT EXISTS "PlatformPlanVersion_planCategory_idx" ON "PlatformPlanVersion"("planCategory");
CREATE INDEX IF NOT EXISTS "PlatformPlanVersion_isPublic_planCategory_displayOrder_idx"
  ON "PlatformPlanVersion"("isPublic", "planCategory", "displayOrder");

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
CREATE INDEX IF NOT EXISTS "PlatformCredit_invoiceId_idx" ON "PlatformCredit"("invoiceId");
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

CREATE TABLE IF NOT EXISTS "PlatformEmailTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "category" TEXT NOT NULL DEFAULT 'transactional',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "variables" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    CONSTRAINT "PlatformEmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformEmailTemplate_code_version_key"
  ON "PlatformEmailTemplate"("code", "version");
CREATE INDEX IF NOT EXISTS "PlatformEmailTemplate_code_idx" ON "PlatformEmailTemplate"("code");
CREATE INDEX IF NOT EXISTS "PlatformEmailTemplate_status_idx" ON "PlatformEmailTemplate"("status");

CREATE TABLE IF NOT EXISTS "PlatformEmailSuppression" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    CONSTRAINT "PlatformEmailSuppression_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformEmailSuppression_email_key" ON "PlatformEmailSuppression"("email");
CREATE INDEX IF NOT EXISTS "PlatformEmailSuppression_active_idx" ON "PlatformEmailSuppression"("active");

CREATE TABLE IF NOT EXISTS "PlatformFeatureEntitlement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "featureCode" TEXT NOT NULL,
    "featureName" TEXT,
    "source" TEXT NOT NULL DEFAULT 'TENANT_OVERRIDE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "grantedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformFeatureEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformFeatureEntitlement_tenantId_featureCode_key"
  ON "PlatformFeatureEntitlement"("tenantId", "featureCode");
CREATE INDEX IF NOT EXISTS "PlatformFeatureEntitlement_tenantId_idx" ON "PlatformFeatureEntitlement"("tenantId");
CREATE INDEX IF NOT EXISTS "PlatformFeatureEntitlement_featureCode_idx" ON "PlatformFeatureEntitlement"("featureCode");
CREATE INDEX IF NOT EXISTS "PlatformFeatureEntitlement_status_idx" ON "PlatformFeatureEntitlement"("status");

CREATE TABLE IF NOT EXISTS "PlatformCustomer" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "taxId" TEXT,
    "domain" TEXT,
    "email" TEXT,
    "accountId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROVISIONING',
    "externalKey" TEXT,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformCustomer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PlatformCustomer_registrationNumber_idx" ON "PlatformCustomer"("registrationNumber");
CREATE INDEX IF NOT EXISTS "PlatformCustomer_taxId_idx" ON "PlatformCustomer"("taxId");
CREATE INDEX IF NOT EXISTS "PlatformCustomer_domain_idx" ON "PlatformCustomer"("domain");
CREATE INDEX IF NOT EXISTS "PlatformCustomer_status_idx" ON "PlatformCustomer"("status");
CREATE INDEX IF NOT EXISTS "PlatformCustomer_accountId_idx" ON "PlatformCustomer"("accountId");
CREATE INDEX IF NOT EXISTS "PlatformCustomer_displayName_idx" ON "PlatformCustomer"("displayName");

CREATE TABLE IF NOT EXISTS "PlatformBillingAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "action" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "metaJson" JSONB,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformBillingAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformBillingAccount_idempotencyKey_key"
  ON "PlatformBillingAccount"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "PlatformBillingAccount_tenantId_idx" ON "PlatformBillingAccount"("tenantId");
CREATE INDEX IF NOT EXISTS "PlatformBillingAccount_customerId_idx" ON "PlatformBillingAccount"("customerId");
CREATE INDEX IF NOT EXISTS "PlatformBillingAccount_status_idx" ON "PlatformBillingAccount"("status");

CREATE TABLE IF NOT EXISTS "PlatformBillingSchedule" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "cycle" TEXT NOT NULL DEFAULT 'month',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "idempotencyKey" TEXT NOT NULL,
    "metaJson" JSONB,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformBillingSchedule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformBillingSchedule_idempotencyKey_key"
  ON "PlatformBillingSchedule"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "PlatformBillingSchedule_billingAccountId_idx"
  ON "PlatformBillingSchedule"("billingAccountId");
CREATE INDEX IF NOT EXISTS "PlatformBillingSchedule_subscriptionId_idx"
  ON "PlatformBillingSchedule"("subscriptionId");
CREATE INDEX IF NOT EXISTS "PlatformBillingSchedule_status_idx" ON "PlatformBillingSchedule"("status");
