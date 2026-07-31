-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "cashFlowClassification" TEXT,
ADD COLUMN     "coaArchitectureVersion" TEXT,
ADD COLUMN     "coaDepth" INTEGER,
ADD COLUMN     "coaEffectiveFrom" TIMESTAMP(3),
ADD COLUMN     "coaEffectiveTo" TIMESTAMP(3),
ADD COLUMN     "coaV2Behaviour" TEXT,
ADD COLUMN     "coaV2Category" TEXT,
ADD COLUMN     "coaV2Metadata" JSONB,
ADD COLUMN     "coaV2NormalBalance" TEXT,
ADD COLUMN     "coaV2Status" TEXT,
ADD COLUMN     "coaV2SubType" TEXT,
ADD COLUMN     "coaV2UpdatedBy" TEXT,
ADD COLUMN     "consolidationGroup" TEXT,
ADD COLUMN     "controlAccountPurpose" TEXT,
ADD COLUMN     "currencyPolicy" TEXT,
ADD COLUMN     "deprecationReason" TEXT,
ADD COLUMN     "displayOrder" INTEGER,
ADD COLUMN     "financialStatementSection" TEXT,
ADD COLUMN     "financialStatementSubsection" TEXT,
ADD COLUMN     "hierarchyPath" TEXT,
ADD COLUMN     "manualPostingAllowed" BOOLEAN,
ADD COLUMN     "postingAllowed" BOOLEAN,
ADD COLUMN     "reconciliationRequired" BOOLEAN,
ADD COLUMN     "replacementAccountId" TEXT,
ADD COLUMN     "specificCurrency" TEXT,
ADD COLUMN     "systemPurpose" TEXT;

-- CreateTable
CREATE TABLE "CoaV2AccountMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL DEFAULT '*',
    "transactionType" TEXT NOT NULL DEFAULT '*',
    "currency" TEXT NOT NULL DEFAULT '*',
    "branchKey" TEXT NOT NULL DEFAULT '*',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "architectureVersion" TEXT NOT NULL DEFAULT 'TRANSITION_V2',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "approvedBy" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoaV2AccountMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoaV2AccountAlias" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "aliasCode" TEXT NOT NULL,
    "aliasName" TEXT,
    "legacyAccountId" TEXT,
    "canonicalAccountId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoaV2AccountAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoaV2Template" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "businessType" TEXT NOT NULL,
    "country" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "baseCodeRanges" JSONB,
    "effectiveFrom" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoaV2Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoaV2TemplateAccount" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentCode" TEXT,
    "category" TEXT NOT NULL,
    "subType" TEXT,
    "behaviour" TEXT NOT NULL,
    "normalBalance" TEXT NOT NULL,
    "systemPurpose" TEXT,
    "controlAccountPurpose" TEXT,
    "financialStatementSection" TEXT,
    "cashFlowClassification" TEXT,
    "currencyPolicy" TEXT NOT NULL DEFAULT 'BASE_CURRENCY_ONLY',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CoaV2TemplateAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoaV2ConsolidationPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "duplicateAccountId" TEXT NOT NULL,
    "canonicalAccountId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "duplicateClass" TEXT,
    "analysis" JSONB,
    "reason" TEXT,
    "phase6RepairRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoaV2ConsolidationPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoaV2AccountMapping_tenantId_purpose_status_idx" ON "CoaV2AccountMapping"("tenantId", "purpose", "status");

-- CreateIndex
CREATE INDEX "CoaV2AccountMapping_accountId_idx" ON "CoaV2AccountMapping"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "CoaV2AccountMapping_tenantId_purpose_moduleKey_transactionT_key" ON "CoaV2AccountMapping"("tenantId", "purpose", "moduleKey", "transactionType", "currency", "branchKey");

-- CreateIndex
CREATE INDEX "CoaV2AccountAlias_tenantId_canonicalAccountId_idx" ON "CoaV2AccountAlias"("tenantId", "canonicalAccountId");

-- CreateIndex
CREATE INDEX "CoaV2AccountAlias_legacyAccountId_idx" ON "CoaV2AccountAlias"("legacyAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "CoaV2AccountAlias_tenantId_aliasCode_key" ON "CoaV2AccountAlias"("tenantId", "aliasCode");

-- CreateIndex
CREATE INDEX "CoaV2Template_businessType_status_idx" ON "CoaV2Template"("businessType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CoaV2Template_templateKey_version_key" ON "CoaV2Template"("templateKey", "version");

-- CreateIndex
CREATE INDEX "CoaV2TemplateAccount_templateId_idx" ON "CoaV2TemplateAccount"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "CoaV2TemplateAccount_templateId_code_key" ON "CoaV2TemplateAccount"("templateId", "code");

-- CreateIndex
CREATE INDEX "CoaV2ConsolidationPlan_tenantId_status_idx" ON "CoaV2ConsolidationPlan"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CoaV2ConsolidationPlan_duplicateAccountId_idx" ON "CoaV2ConsolidationPlan"("duplicateAccountId");

-- CreateIndex
CREATE INDEX "Account_tenantId_systemPurpose_idx" ON "Account"("tenantId", "systemPurpose");

-- CreateIndex
CREATE INDEX "Account_tenantId_coaV2Status_idx" ON "Account"("tenantId", "coaV2Status");

-- CreateIndex
CREATE INDEX "Account_tenantId_coaV2Category_idx" ON "Account"("tenantId", "coaV2Category");

-- CreateIndex
CREATE INDEX "Account_tenantId_coaV2Behaviour_idx" ON "Account"("tenantId", "coaV2Behaviour");

-- CreateIndex
CREATE INDEX "Account_replacementAccountId_idx" ON "Account"("replacementAccountId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_replacementAccountId_fkey" FOREIGN KEY ("replacementAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaV2AccountMapping" ADD CONSTRAINT "CoaV2AccountMapping_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaV2AccountAlias" ADD CONSTRAINT "CoaV2AccountAlias_legacyAccountId_fkey" FOREIGN KEY ("legacyAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaV2AccountAlias" ADD CONSTRAINT "CoaV2AccountAlias_canonicalAccountId_fkey" FOREIGN KEY ("canonicalAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaV2TemplateAccount" ADD CONSTRAINT "CoaV2TemplateAccount_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CoaV2Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaV2ConsolidationPlan" ADD CONSTRAINT "CoaV2ConsolidationPlan_duplicateAccountId_fkey" FOREIGN KEY ("duplicateAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoaV2ConsolidationPlan" ADD CONSTRAINT "CoaV2ConsolidationPlan_canonicalAccountId_fkey" FOREIGN KEY ("canonicalAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

