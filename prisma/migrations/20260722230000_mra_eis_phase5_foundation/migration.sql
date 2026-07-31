-- MRA EIS Phase 5 — operational persistence foundation
-- Additive. No plaintext credentials. No Sale/Journal/Stock mutations.

CREATE TABLE IF NOT EXISTS "MraEisTerminal" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "branchId" TEXT,
  "siteMappingId" TEXT,
  "environment" TEXT NOT NULL,
  "mraTerminalId" TEXT,
  "terminalPosition" TEXT,
  "terminalLabel" TEXT NOT NULL,
  "productId" TEXT,
  "productVersion" TEXT,
  "platformIdentityReference" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "previousStatus" TEXT,
  "activationAttemptCount" INTEGER NOT NULL DEFAULT 0,
  "activationRequestedAt" TIMESTAMP(3),
  "activationResponseReceivedAt" TIMESTAMP(3),
  "credentialsPersistedAt" TIMESTAMP(3),
  "activationConfirmedAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "tokenExpiresAt" TIMESTAMP(3),
  "currentCredentialReferenceId" TEXT,
  "activeGlobalConfigurationSnapshotId" TEXT,
  "activeTerminalConfigurationSnapshotId" TEXT,
  "activeTaxpayerConfigurationSnapshotId" TEXT,
  "lastConfigurationSyncAt" TIMESTAMP(3),
  "lastSuccessfulContactAt" TIMESTAMP(3),
  "lastOnlineAcceptedAt" TIMESTAMP(3),
  "lastOfflineAcceptedAt" TIMESTAMP(3),
  "blockedAt" TIMESTAMP(3),
  "blockReason" TEXT,
  "unblockCheckedAt" TIMESTAMP(3),
  "offlineCertified" BOOLEAN NOT NULL DEFAULT false,
  "offlineMaximumAmount" DECIMAL(18,2),
  "offlineMaximumAgeHours" INTEGER,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retentionUntil" TIMESTAMP(3),
  "legalHold" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "MraEisTerminal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MraEisTerminal_tenant_business_status_idx" ON "MraEisTerminal"("tenantId","businessId","status");
CREATE INDEX IF NOT EXISTS "MraEisTerminal_tenant_env_idx" ON "MraEisTerminal"("tenantId","environment");
CREATE INDEX IF NOT EXISTS "MraEisTerminal_business_status_idx" ON "MraEisTerminal"("businessId","status");
CREATE INDEX IF NOT EXISTS "MraEisTerminal_mraTerminalId_idx" ON "MraEisTerminal"("mraTerminalId");
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisTerminal_label_unique" ON "MraEisTerminal"("tenantId","businessId","environment","terminalLabel");
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisTerminal_mraId_env_unique" ON "MraEisTerminal"("tenantId","environment","mraTerminalId") WHERE "mraTerminalId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisTerminal_position_env_unique" ON "MraEisTerminal"("tenantId","environment","terminalPosition") WHERE "terminalPosition" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "MraEisCredentialReference" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "terminalId" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "credentialType" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'PHASE6_VAULT',
  "vaultReference" TEXT NOT NULL,
  "keyVersion" TEXT NOT NULL DEFAULT 'v0',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "rotatedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "replacedByReferenceId" TEXT,
  "accessPolicyVersion" TEXT NOT NULL DEFAULT 'v1',
  "metadataChecksum" TEXT,
  "createdByService" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "MraEisCredentialReference_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MraEisCredentialReference_scope_idx" ON "MraEisCredentialReference"("tenantId","businessId","terminalId");
CREATE INDEX IF NOT EXISTS "MraEisCredentialReference_type_status_idx" ON "MraEisCredentialReference"("terminalId","credentialType","status");
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisCredentialReference_vault_unique" ON "MraEisCredentialReference"("terminalId","credentialType","vaultReference");
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisCredentialReference_one_active" ON "MraEisCredentialReference"("terminalId","credentialType") WHERE "status" = 'ACTIVE';

CREATE TABLE IF NOT EXISTS "MraEisConfigurationSnapshot" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "terminalId" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "configurationType" TEXT NOT NULL,
  "mraVersion" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL DEFAULT '1',
  "contractVersion" TEXT NOT NULL DEFAULT '1',
  "effectiveFrom" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validatedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL,
  "canonicalData" JSONB NOT NULL,
  "safeRawResponseReference" TEXT,
  "sourceChecksum" TEXT NOT NULL,
  "validationChecksum" TEXT,
  "validationErrors" JSONB,
  "activatedAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),
  "createdByService" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retentionUntil" TIMESTAMP(3),
  "legalHold" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "MraEisConfigurationSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisConfigurationSnapshot_version_unique" ON "MraEisConfigurationSnapshot"("terminalId","configurationType","mraVersion");
CREATE INDEX IF NOT EXISTS "MraEisConfigurationSnapshot_status_idx" ON "MraEisConfigurationSnapshot"("terminalId","configurationType","status");
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisConfigurationSnapshot_one_active" ON "MraEisConfigurationSnapshot"("terminalId","configurationType") WHERE "status" = 'ACTIVE';

CREATE TABLE IF NOT EXISTS "MraEisConfigurationActivation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "terminalId" TEXT NOT NULL,
  "configurationType" TEXT NOT NULL,
  "previousSnapshotId" TEXT,
  "activatedSnapshotId" TEXT NOT NULL,
  "reason" TEXT,
  "activatedBy" TEXT NOT NULL,
  "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "correlationId" TEXT,
  "requestId" TEXT,
  CONSTRAINT "MraEisConfigurationActivation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MraEisConfigurationActivation_hist_idx" ON "MraEisConfigurationActivation"("terminalId","configurationType","activatedAt");

CREATE TABLE IF NOT EXISTS "MraEisSite" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "terminalId" TEXT,
  "environment" TEXT NOT NULL,
  "mraTin" TEXT NOT NULL,
  "mraSiteId" TEXT NOT NULL,
  "siteName" TEXT NOT NULL,
  "siteType" TEXT,
  "addressLine1" TEXT,
  "addressLine2" TEXT,
  "city" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sourceConfigurationSnapshotId" TEXT,
  "sourceChecksum" TEXT NOT NULL,
  "synchronizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "supersededAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisSite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisSite_identity_unique" ON "MraEisSite"("tenantId","businessId","environment","mraTin","mraSiteId");
CREATE INDEX IF NOT EXISTS "MraEisSite_active_idx" ON "MraEisSite"("businessId","environment","active");

CREATE TABLE IF NOT EXISTS "MraEisSiteMapping" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "warehouseId" TEXT,
  "terminalId" TEXT,
  "mraSiteId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "sourceConfigurationVersion" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "verifiedBy" TEXT,
  "reason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisSiteMapping_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MraEisSiteMapping_dates_chk" CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom")
);
CREATE INDEX IF NOT EXISTS "MraEisSiteMapping_status_idx" ON "MraEisSiteMapping"("tenantId","businessId","status");
CREATE INDEX IF NOT EXISTS "MraEisSiteMapping_branch_idx" ON "MraEisSiteMapping"("businessId","branchId","status");

CREATE TABLE IF NOT EXISTS "MraEisExternalCatalogueItem" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "terminalId" TEXT,
  "environment" TEXT NOT NULL,
  "mraTin" TEXT NOT NULL,
  "mraSiteId" TEXT NOT NULL,
  "externalType" TEXT NOT NULL,
  "mraCode" TEXT NOT NULL,
  "barcode" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "unitOfMeasure" TEXT,
  "unitPrice" DECIMAL(18,2),
  "costPrice" DECIMAL(18,2),
  "sellingPrice" DECIMAL(18,2),
  "quantity" DECIMAL(18,6),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sourceVersion" TEXT NOT NULL,
  "sourceChecksum" TEXT NOT NULL,
  "synchronizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "supersededAt" TIMESTAMP(3),
  "rawRecordReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisExternalCatalogueItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisExternalCatalogueItem_unique" ON "MraEisExternalCatalogueItem"("tenantId","businessId","environment","mraSiteId","externalType","mraCode","sourceVersion");
CREATE INDEX IF NOT EXISTS "MraEisExternalCatalogueItem_code_idx" ON "MraEisExternalCatalogueItem"("mraCode");

CREATE TABLE IF NOT EXISTS "MraEisProductMapping" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "branchId" TEXT,
  "localItemId" TEXT,
  "localServiceId" TEXT,
  "externalCatalogueItemId" TEXT NOT NULL,
  "mappingType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "unitConversionRule" TEXT,
  "taxMappingId" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "mappingVersion" INTEGER NOT NULL DEFAULT 1,
  "verifiedAt" TIMESTAMP(3),
  "verifiedBy" TEXT,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "reason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisProductMapping_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MraEisProductMapping_local_chk" CHECK (
    (("localItemId" IS NOT NULL AND "localServiceId" IS NULL) OR ("localItemId" IS NULL AND "localServiceId" IS NOT NULL))
  )
);
CREATE INDEX IF NOT EXISTS "MraEisProductMapping_status_idx" ON "MraEisProductMapping"("tenantId","businessId","status");
CREATE INDEX IF NOT EXISTS "MraEisProductMapping_item_idx" ON "MraEisProductMapping"("localItemId","status");
CREATE INDEX IF NOT EXISTS "MraEisProductMapping_service_idx" ON "MraEisProductMapping"("localServiceId","status");

CREATE TABLE IF NOT EXISTS "MraEisTaxMapping" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "terminalId" TEXT,
  "localTaxRateId" TEXT NOT NULL,
  "mraTaxRateId" TEXT NOT NULL,
  "chargeMode" TEXT,
  "sourceConfigurationSnapshotId" TEXT,
  "status" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "mappingVersion" INTEGER NOT NULL DEFAULT 1,
  "localRateSnapshot" DECIMAL(18,6) NOT NULL,
  "mraRateSnapshot" DECIMAL(18,6) NOT NULL,
  "differenceReason" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "verifiedBy" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisTaxMapping_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MraEisTaxMapping_status_idx" ON "MraEisTaxMapping"("tenantId","businessId","status");
CREATE INDEX IF NOT EXISTS "MraEisTaxMapping_local_idx" ON "MraEisTaxMapping"("localTaxRateId","status");

CREATE TABLE IF NOT EXISTS "MraEisLevyMapping" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "localLevyId" TEXT NOT NULL,
  "mraLevyId" TEXT NOT NULL,
  "sourceConfigurationSnapshotId" TEXT,
  "chargeMode" TEXT,
  "status" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "mappingVersion" INTEGER NOT NULL DEFAULT 1,
  "localRateSnapshot" DECIMAL(18,6),
  "mraRateSnapshot" DECIMAL(18,6),
  "verifiedAt" TIMESTAMP(3),
  "verifiedBy" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisLevyMapping_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MraEisLevyMapping_status_idx" ON "MraEisLevyMapping"("tenantId","businessId","status");

CREATE TABLE IF NOT EXISTS "MraEisPaymentMethodMapping" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "localPaymentMethodId" TEXT NOT NULL,
  "mraPaymentMethodCode" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "mappingVersion" INTEGER NOT NULL DEFAULT 1,
  "verifiedAt" TIMESTAMP(3),
  "verifiedBy" TEXT,
  "notes" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisPaymentMethodMapping_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MraEisPaymentMethodMapping_status_idx" ON "MraEisPaymentMethodMapping"("tenantId","businessId","status");

CREATE TABLE IF NOT EXISTS "MraEisFiscalSequence" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "terminalId" TEXT NOT NULL,
  "businessDate" DATE NOT NULL,
  "lastAllocatedSequence" INTEGER NOT NULL DEFAULT 0,
  "algorithmVersion" TEXT NOT NULL DEFAULT 'UNVERIFIED_PHASE5',
  "timezone" TEXT NOT NULL DEFAULT 'Africa/Blantyre',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisFiscalSequence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MraEisFiscalSequence_nonneg_chk" CHECK ("lastAllocatedSequence" >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisFiscalSequence_unique" ON "MraEisFiscalSequence"("terminalId","businessDate");

CREATE TABLE IF NOT EXISTS "MraEisFiscalNumberAllocation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "terminalId" TEXT NOT NULL,
  "snapshotId" TEXT,
  "businessDate" DATE NOT NULL,
  "dailySequence" INTEGER NOT NULL,
  "generatedFiscalNumber" TEXT,
  "algorithmVersion" TEXT NOT NULL DEFAULT 'UNVERIFIED_PHASE5',
  "allocationStatus" TEXT NOT NULL,
  "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "allocatedByService" TEXT NOT NULL,
  "correlationId" TEXT,
  "requestId" TEXT,
  "reason" TEXT,
  CONSTRAINT "MraEisFiscalNumberAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MraEisFiscalNumberAllocation_seq_chk" CHECK ("dailySequence" > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisFiscalNumberAllocation_seq_unique" ON "MraEisFiscalNumberAllocation"("terminalId","businessDate","dailySequence");
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisFiscalNumberAllocation_number_unique" ON "MraEisFiscalNumberAllocation"("generatedFiscalNumber") WHERE "generatedFiscalNumber" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "MraEisSnapshot" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "branchId" TEXT,
  "terminalId" TEXT NOT NULL,
  "siteMappingId" TEXT,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceVersion" TEXT NOT NULL,
  "sourceEventId" TEXT,
  "localDocumentNumber" TEXT,
  "journalEntryId" TEXT,
  "transactionDate" TIMESTAMP(3) NOT NULL,
  "postingDate" TIMESTAMP(3) NOT NULL,
  "businessDate" DATE NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Africa/Blantyre',
  "environment" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "apiContractVersion" TEXT NOT NULL DEFAULT '1',
  "payloadMapperVersion" TEXT NOT NULL DEFAULT '1',
  "fiscalNumberAllocationId" TEXT,
  "sellerTin" TEXT,
  "sellerName" TEXT,
  "tradingName" TEXT,
  "buyerCustomerId" TEXT,
  "buyerName" TEXT,
  "buyerTin" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'MWK',
  "subtotal" DECIMAL(18,2) NOT NULL,
  "discountTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "taxTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "levyTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "invoiceTotal" DECIMAL(18,2) NOT NULL,
  "amountTendered" DECIMAL(18,2),
  "changeAmount" DECIMAL(18,2),
  "configurationVersionSummary" JSONB,
  "mappingVersionSummary" JSONB,
  "snapshotChecksum" TEXT NOT NULL,
  "canonicalSnapshot" JSONB NOT NULL,
  "createdByService" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "queuedAt" TIMESTAMP(3),
  "immutableAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "retentionUntil" TIMESTAMP(3),
  "legalHold" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "MraEisSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisSnapshot_source_unique" ON "MraEisSnapshot"("sourceType","sourceId","sourceVersion","policyVersion");
CREATE INDEX IF NOT EXISTS "MraEisSnapshot_business_date_idx" ON "MraEisSnapshot"("tenantId","businessId","businessDate");
CREATE INDEX IF NOT EXISTS "MraEisSnapshot_terminal_status_idx" ON "MraEisSnapshot"("terminalId","status");
CREATE INDEX IF NOT EXISTS "MraEisSnapshot_checksum_idx" ON "MraEisSnapshot"("snapshotChecksum");

CREATE TABLE IF NOT EXISTS "MraEisSnapshotLine" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "localSourceLineId" TEXT,
  "localItemId" TEXT,
  "localServiceId" TEXT,
  "productMappingId" TEXT,
  "mappingVersion" INTEGER,
  "mraCode" TEXT,
  "description" TEXT NOT NULL,
  "isProduct" BOOLEAN NOT NULL,
  "unitOfMeasure" TEXT,
  "quantity" DECIMAL(18,6) NOT NULL,
  "unitPrice" DECIMAL(18,2) NOT NULL,
  "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "netAmount" DECIMAL(18,2) NOT NULL,
  "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "levyAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "grossAmount" DECIMAL(18,2) NOT NULL,
  "taxMappingId" TEXT,
  "mraTaxRateId" TEXT,
  "levyMappingSummary" JSONB,
  "lineChecksum" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisSnapshotLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MraEisSnapshotLine_snapshot_fkey" FOREIGN KEY ("snapshotId") REFERENCES "MraEisSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisSnapshotLine_seq_unique" ON "MraEisSnapshotLine"("snapshotId","sequence");
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisSnapshotLine_local_unique" ON "MraEisSnapshotLine"("snapshotId","localSourceLineId") WHERE "localSourceLineId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "MraEisSnapshotPayment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "localPaymentReferenceId" TEXT,
  "paymentMethodMappingId" TEXT,
  "localPaymentMethodId" TEXT,
  "mraPaymentMethodCode" TEXT,
  "amount" DECIMAL(18,2) NOT NULL,
  "amountTendered" DECIMAL(18,2),
  "changeAmount" DECIMAL(18,2),
  "isCreditComponent" BOOLEAN NOT NULL DEFAULT false,
  "paymentChecksum" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisSnapshotPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MraEisSnapshotPayment_snapshot_fkey" FOREIGN KEY ("snapshotId") REFERENCES "MraEisSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisSnapshotPayment_seq_unique" ON "MraEisSnapshotPayment"("snapshotId","sequence");

CREATE TABLE IF NOT EXISTS "MraEisTransmission" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "terminalId" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "fiscalNumberAllocationId" TEXT,
  "environment" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "previousStatus" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "currentAttemptId" TEXT,
  "firstQueuedAt" TIMESTAMP(3),
  "claimedAt" TIMESTAMP(3),
  "claimedByWorker" TEXT,
  "claimExpiresAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "nextAttemptAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "unknownOutcomeAt" TIMESTAMP(3),
  "reconciledAt" TIMESTAMP(3),
  "validationUrl" TEXT,
  "mraApplicationStatus" TEXT,
  "mraRemark" TEXT,
  "shouldRefreshConfiguration" BOOLEAN NOT NULL DEFAULT false,
  "shouldBlockTerminal" BOOLEAN NOT NULL DEFAULT false,
  "latestResponseId" TEXT,
  "safeErrorCode" TEXT,
  "safeErrorSummary" TEXT,
  "manualReviewReason" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retentionUntil" TIMESTAMP(3),
  "legalHold" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "MraEisTransmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisTransmission_idem_unique" ON "MraEisTransmission"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisTransmission_snapshot_mode_unique" ON "MraEisTransmission"("snapshotId","mode");
CREATE INDEX IF NOT EXISTS "MraEisTransmission_queue_idx" ON "MraEisTransmission"("status","nextAttemptAt");
CREATE INDEX IF NOT EXISTS "MraEisTransmission_terminal_queue_idx" ON "MraEisTransmission"("terminalId","status","nextAttemptAt");

CREATE TABLE IF NOT EXISTS "MraEisTransmissionAttempt" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "transmissionId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "endpointKey" TEXT NOT NULL,
  "httpMethod" TEXT NOT NULL DEFAULT 'POST',
  "requestContractVersion" TEXT NOT NULL DEFAULT '1',
  "requestChecksum" TEXT NOT NULL,
  "responseChecksum" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "durationMilliseconds" INTEGER,
  "outcome" TEXT NOT NULL,
  "httpStatus" INTEGER,
  "mraApplicationStatus" TEXT,
  "safeErrorCode" TEXT,
  "safeErrorSummary" TEXT,
  "retryClassification" TEXT NOT NULL,
  "workerId" TEXT,
  "requestId" TEXT,
  "correlationId" TEXT,
  "sanitizedRequestReference" TEXT,
  "sanitizedResponseReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisTransmissionAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisTransmissionAttempt_unique" ON "MraEisTransmissionAttempt"("transmissionId","attemptNumber");

CREATE TABLE IF NOT EXISTS "MraEisResponse" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "terminalId" TEXT NOT NULL,
  "transmissionId" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "httpStatus" INTEGER,
  "mraApplicationStatus" TEXT,
  "remark" TEXT,
  "responseCategory" TEXT NOT NULL,
  "validationUrl" TEXT,
  "validationErrors" JSONB,
  "shouldRefreshConfiguration" BOOLEAN NOT NULL DEFAULT false,
  "shouldBlockTerminal" BOOLEAN NOT NULL DEFAULT false,
  "sourceChecksum" TEXT NOT NULL,
  "sanitizedCanonicalResponse" JSONB NOT NULL,
  "secureRawResponseReference" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "contractVersion" TEXT NOT NULL DEFAULT '1',
  "parserVersion" TEXT NOT NULL DEFAULT '1',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "legalHold" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "MraEisResponse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisResponse_attempt_unique" ON "MraEisResponse"("attemptId");
CREATE INDEX IF NOT EXISTS "MraEisResponse_transmission_idx" ON "MraEisResponse"("transmissionId");

CREATE TABLE IF NOT EXISTS "MraEisReceiptProjection" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "snapshotId" TEXT,
  "transmissionId" TEXT,
  "localDocumentNumber" TEXT,
  "fiscalNumber" TEXT,
  "eisStatus" TEXT NOT NULL,
  "validationUrl" TEXT,
  "qrContentChecksum" TEXT,
  "qrAssetReference" TEXT,
  "mode" TEXT,
  "terminalId" TEXT,
  "siteMappingId" TEXT,
  "sellerTin" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "projectionVersion" INTEGER NOT NULL DEFAULT 1,
  "sourceEventVersion" TEXT,
  "rebuiltAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisReceiptProjection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisReceiptProjection_source_unique" ON "MraEisReceiptProjection"("sourceType","sourceId");
CREATE INDEX IF NOT EXISTS "MraEisReceiptProjection_status_idx" ON "MraEisReceiptProjection"("tenantId","businessId","eisStatus");

CREATE TABLE IF NOT EXISTS "MraEisVat5Validation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "terminalId" TEXT,
  "customerId" TEXT,
  "projectNumber" TEXT NOT NULL,
  "certificateNumber" TEXT NOT NULL,
  "requestedQuantity" DECIMAL(18,6) NOT NULL,
  "eligibleQuantity" DECIMAL(18,6),
  "remainingQuantity" DECIMAL(18,6),
  "status" TEXT NOT NULL,
  "validationReference" TEXT,
  "sourceChecksum" TEXT,
  "validatedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "reservedQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "consumedQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "releasedQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "snapshotId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisVat5Validation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MraEisVat5Validation_qty_chk" CHECK (
    "eligibleQuantity" IS NULL OR ("reservedQuantity" + "consumedQuantity") <= "eligibleQuantity"
  )
);
CREATE INDEX IF NOT EXISTS "MraEisVat5Validation_status_idx" ON "MraEisVat5Validation"("tenantId","businessId","status");

CREATE TABLE IF NOT EXISTS "MraEisOfflineQueueEntry" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "branchId" TEXT,
  "terminalId" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "fiscalNumberAllocationId" TEXT,
  "status" TEXT NOT NULL,
  "offlineSignatureReference" TEXT,
  "offlineValidationUrl" TEXT,
  "snapshotChecksum" TEXT NOT NULL,
  "queuedAt" TIMESTAMP(3),
  "originalTransactionDate" TIMESTAMP(3) NOT NULL,
  "cumulativeAmountAtCreation" DECIMAL(18,2) NOT NULL,
  "maximumCumulativeAmount" DECIMAL(18,2) NOT NULL,
  "oldestAllowedSubmissionAt" TIMESTAMP(3),
  "uploadAttemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastUploadAttemptAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "safeErrorCode" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "legalHold" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "MraEisOfflineQueueEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisOfflineQueueEntry_snapshot_unique" ON "MraEisOfflineQueueEntry"("snapshotId");
CREATE INDEX IF NOT EXISTS "MraEisOfflineQueueEntry_status_idx" ON "MraEisOfflineQueueEntry"("tenantId","businessId","status");

CREATE TABLE IF NOT EXISTS "MraEisReconciliationRun" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "terminalId" TEXT,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "dateFrom" TIMESTAMP(3),
  "dateTo" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "initiatedBy" TEXT NOT NULL,
  "initiationSource" TEXT NOT NULL,
  "recordsExamined" INTEGER NOT NULL DEFAULT 0,
  "differencesFound" INTEGER NOT NULL DEFAULT 0,
  "criticalDifferences" INTEGER NOT NULL DEFAULT 0,
  "highDifferences" INTEGER NOT NULL DEFAULT 0,
  "safeErrorCode" TEXT,
  "correlationId" TEXT,
  "requestId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisReconciliationRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MraEisReconciliationRun_status_idx" ON "MraEisReconciliationRun"("tenantId","businessId","status");

CREATE TABLE IF NOT EXISTS "MraEisReconciliationDifference" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "reconciliationRunId" TEXT NOT NULL,
  "terminalId" TEXT,
  "snapshotId" TEXT,
  "transmissionId" TEXT,
  "differenceType" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "localValue" TEXT,
  "externalValue" TEXT,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "assignedTo" TEXT,
  "resolvedBy" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolutionReason" TEXT,
  "resolutionEvidenceReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisReconciliationDifference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MraEisReconciliationDifference_run_fkey" FOREIGN KEY ("reconciliationRunId") REFERENCES "MraEisReconciliationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "MraEisReconciliationDifference_run_idx" ON "MraEisReconciliationDifference"("reconciliationRunId","severity","status");

CREATE TABLE IF NOT EXISTS "MraEisSyncRun" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "terminalId" TEXT,
  "syncType" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "requestedBy" TEXT NOT NULL,
  "sourceVersion" TEXT,
  "targetVersion" TEXT,
  "recordsReceived" INTEGER NOT NULL DEFAULT 0,
  "recordsCreated" INTEGER NOT NULL DEFAULT 0,
  "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
  "recordsUnchanged" INTEGER NOT NULL DEFAULT 0,
  "recordsRejected" INTEGER NOT NULL DEFAULT 0,
  "warnings" JSONB,
  "safeErrorCode" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "correlationId" TEXT,
  "requestId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisSyncRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisSyncRun_idem_unique" ON "MraEisSyncRun"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "MraEisSyncRun_type_idx" ON "MraEisSyncRun"("tenantId","businessId","syncType","status");

CREATE TABLE IF NOT EXISTS "MraEisManualReviewCase" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "terminalId" TEXT,
  "caseType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "severity" TEXT NOT NULL,
  "sourceEntityType" TEXT NOT NULL,
  "sourceEntityId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "assignedTo" TEXT,
  "openedBy" TEXT NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3),
  "resolutionType" TEXT,
  "resolutionReason" TEXT,
  "resolvedBy" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "approvalId" TEXT,
  "evidenceReference" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisManualReviewCase_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MraEisManualReviewCase_status_idx" ON "MraEisManualReviewCase"("tenantId","businessId","status");

CREATE TABLE IF NOT EXISTS "MraEisAlertState" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT,
  "terminalId" TEXT,
  "alertType" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "deduplicationKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "firstTriggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastTriggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "triggerCount" INTEGER NOT NULL DEFAULT 1,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedBy" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" TEXT,
  "resolutionReason" TEXT,
  "sourceEntityType" TEXT,
  "sourceEntityId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisAlertState_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisAlertState_dedupe_unique" ON "MraEisAlertState"("deduplicationKey");
CREATE INDEX IF NOT EXISTS "MraEisAlertState_status_idx" ON "MraEisAlertState"("tenantId","status");

CREATE TABLE IF NOT EXISTS "MraEisOutbox" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "eventVersion" TEXT NOT NULL DEFAULT '1',
  "payload" JSONB NOT NULL,
  "payloadChecksum" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TIMESTAMP(3),
  "claimExpiresAt" TIMESTAMP(3),
  "claimedBy" TEXT,
  "processedAt" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "safeErrorCode" TEXT,
  "requestId" TEXT,
  "correlationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisOutbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisOutbox_idem_unique" ON "MraEisOutbox"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "MraEisOutbox_claim_idx" ON "MraEisOutbox"("status","availableAt");
CREATE INDEX IF NOT EXISTS "MraEisOutbox_tenant_idx" ON "MraEisOutbox"("tenantId","businessId","eventType");
