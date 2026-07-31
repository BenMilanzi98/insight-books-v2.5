-- Rental & Hiring V2 — catalogue, contracts, deposits, dispatch/return, inbound hire
-- Focused migration (noise from prisma migrate diff removed)

-- AlterTable
ALTER TABLE "RentalAsset" ADD COLUMN     "code" TEXT,
ADD COLUMN     "defaultDeposit" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "fixedAssetId" TEXT,
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "rentalType" TEXT NOT NULL DEFAULT 'CUSTOM';

-- CreateTable
CREATE TABLE "RentalUnit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "rentalAssetId" TEXT NOT NULL,
    "code" TEXT,
    "serialNumber" TEXT,
    "barcode" TEXT,
    "fixedAssetId" TEXT,
    "availabilityStatus" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "conditionStatus" TEXT NOT NULL DEFAULT 'GOOD',
    "maintenanceStatus" TEXT NOT NULL DEFAULT 'OK',
    "currentMeter" DECIMAL(18,4),
    "meterType" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalRatePlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rentalAssetId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "billingUnit" TEXT NOT NULL DEFAULT 'day',
    "baseRate" DECIMAL(18,2) NOT NULL,
    "minimumCharge" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "depositAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "overtimeRate" DECIMAL(18,2),
    "lateFeePerDay" DECIMAL(18,2),
    "graceHours" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalRatePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalQuotation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxEstimate" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalEstimate" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "depositEstimate" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "pricingSnapshot" JSONB,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalQuotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalQuotationLine" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "rentalAssetId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitRate" DECIMAL(18,2) NOT NULL,
    "billableUnits" DECIMAL(18,4) NOT NULL,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "description" TEXT,

    CONSTRAINT "RentalQuotationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalReservation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reservationNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "quotationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "holdUntil" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalUnitAllocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rentalUnitId" TEXT,
    "rentalAssetId" TEXT NOT NULL,
    "reservationId" TEXT,
    "contractId" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'HELD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentalUnitAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalContract" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "contractNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "reservationId" TEXT,
    "quotationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "billingPolicy" TEXT NOT NULL DEFAULT 'BILL_AT_INVOICE',
    "billingFrequency" TEXT NOT NULL DEFAULT 'AT_RETURN',
    "billingStatus" TEXT NOT NULL DEFAULT 'UNBILLED',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "returnStatus" TEXT NOT NULL DEFAULT 'NOT_RETURNED',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "expectedReturnAt" TIMESTAMP(3),
    "actualReturnAt" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "depositRequired" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "depositReceived" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "subtotalEstimate" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxEstimate" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalEstimate" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pricingVersion" INTEGER NOT NULL DEFAULT 1,
    "pricingSnapshot" JSONB,
    "mappingSnapshot" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalContractLine" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "rentalAssetId" TEXT NOT NULL,
    "rentalUnitId" TEXT,
    "lineType" TEXT NOT NULL DEFAULT 'RENTAL_ASSET',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "billingUnit" TEXT NOT NULL DEFAULT 'day',
    "unitRate" DECIMAL(18,2) NOT NULL,
    "minimumCharge" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "depositAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "ratePlanId" TEXT,
    "ratePlanVersion" INTEGER,
    "pricingSnapshot" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "RentalContractLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalDeposit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "depositType" TEXT NOT NULL DEFAULT 'REFUNDABLE_SECURITY',
    "amount" DECIMAL(18,2) NOT NULL,
    "receivedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "appliedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "refundedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "forfeitedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "journalId" TEXT,
    "idempotencyKey" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalDispatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "dispatchNumber" TEXT NOT NULL,
    "dispatchAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchType" TEXT NOT NULL DEFAULT 'PICKUP',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "meterOpening" DECIMAL(18,4),
    "fuelLevel" TEXT,
    "conditionNotes" TEXT,
    "customerAck" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalDispatchLine" (
    "id" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "rentalUnitId" TEXT,
    "rentalAssetId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RentalDispatchLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalReturn" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "returnAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'RETURN_REQUESTED',
    "meterClosing" DECIMAL(18,4),
    "fuelLevel" TEXT,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "lateHours" DECIMAL(18,4),
    "idempotencyKey" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalReturnLine" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "rentalUnitId" TEXT,
    "rentalAssetId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RentalReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalInspection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "rentalUnitId" TEXT,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" TEXT NOT NULL DEFAULT 'PASSED',
    "damageDetected" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceRequired" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentalInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalCharge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "returnId" TEXT,
    "inspectionId" TEXT,
    "chargeType" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "billingStatus" TEXT NOT NULL DEFAULT 'UNBILLED',
    "invoiceId" TEXT,
    "idempotencyKey" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalBillingPeriod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "pricingVersion" INTEGER NOT NULL DEFAULT 1,
    "amount" DECIMAL(18,2) NOT NULL,
    "invoiceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'BILLED',
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentalBillingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalUsageRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "rentalUnitId" TEXT,
    "meterType" TEXT NOT NULL,
    "openingReading" DECIMAL(18,4) NOT NULL,
    "closingReading" DECIMAL(18,4) NOT NULL,
    "usageAmount" DECIMAL(18,4) NOT NULL,
    "billingStatus" TEXT NOT NULL DEFAULT 'UNBILLED',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentalUsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalExtension" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "requestedEndAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "priceDelta" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "conflictNotes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalExtension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HireRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "requestedById" TEXT,
    "branchId" TEXT,
    "projectId" TEXT,
    "description" TEXT NOT NULL,
    "equipmentSpec" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "estimatedCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HireRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HireAgreement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agreementNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "hireRequestId" TEXT,
    "branchId" TEXT,
    "projectId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "estimatedValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "billedValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "accountingPolicy" TEXT NOT NULL DEFAULT 'DIRECT_BILL',
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HireAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HireDelivery" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "serialNumber" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "conditionNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HireDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HireUsageRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "usageDate" TIMESTAMP(3) NOT NULL,
    "hours" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "billingStatus" TEXT NOT NULL DEFAULT 'UNBILLED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HireUsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HireSupplierDeposit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "refundedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "appliedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "journalId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HireSupplierDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HireAccrual" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACCRUED',
    "journalId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HireAccrual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RentalUnit_tenantId_idx" ON "RentalUnit"("tenantId");

-- CreateIndex
CREATE INDEX "RentalUnit_rentalAssetId_idx" ON "RentalUnit"("rentalAssetId");

-- CreateIndex
CREATE INDEX "RentalUnit_availabilityStatus_idx" ON "RentalUnit"("availabilityStatus");

-- CreateIndex
CREATE INDEX "RentalUnit_fixedAssetId_idx" ON "RentalUnit"("fixedAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalUnit_tenantId_serialNumber_key" ON "RentalUnit"("tenantId", "serialNumber");

-- CreateIndex
CREATE INDEX "RentalRatePlan_tenantId_rentalAssetId_idx" ON "RentalRatePlan"("tenantId", "rentalAssetId");

-- CreateIndex
CREATE INDEX "RentalRatePlan_isActive_idx" ON "RentalRatePlan"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RentalRatePlan_tenantId_code_version_key" ON "RentalRatePlan"("tenantId", "code", "version");

-- CreateIndex
CREATE INDEX "RentalQuotation_tenantId_idx" ON "RentalQuotation"("tenantId");

-- CreateIndex
CREATE INDEX "RentalQuotation_clientId_idx" ON "RentalQuotation"("clientId");

-- CreateIndex
CREATE INDEX "RentalQuotation_status_idx" ON "RentalQuotation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RentalQuotation_tenantId_quotationNumber_key" ON "RentalQuotation"("tenantId", "quotationNumber");

-- CreateIndex
CREATE INDEX "RentalQuotationLine_quotationId_idx" ON "RentalQuotationLine"("quotationId");

-- CreateIndex
CREATE INDEX "RentalQuotationLine_rentalAssetId_idx" ON "RentalQuotationLine"("rentalAssetId");

-- CreateIndex
CREATE INDEX "RentalReservation_tenantId_idx" ON "RentalReservation"("tenantId");

-- CreateIndex
CREATE INDEX "RentalReservation_clientId_idx" ON "RentalReservation"("clientId");

-- CreateIndex
CREATE INDEX "RentalReservation_status_idx" ON "RentalReservation"("status");

-- CreateIndex
CREATE INDEX "RentalReservation_startAt_endAt_idx" ON "RentalReservation"("startAt", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "RentalReservation_tenantId_reservationNumber_key" ON "RentalReservation"("tenantId", "reservationNumber");

-- CreateIndex
CREATE INDEX "RentalUnitAllocation_tenantId_idx" ON "RentalUnitAllocation"("tenantId");

-- CreateIndex
CREATE INDEX "RentalUnitAllocation_rentalUnitId_startAt_endAt_idx" ON "RentalUnitAllocation"("rentalUnitId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "RentalUnitAllocation_rentalAssetId_startAt_endAt_idx" ON "RentalUnitAllocation"("rentalAssetId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "RentalUnitAllocation_reservationId_idx" ON "RentalUnitAllocation"("reservationId");

-- CreateIndex
CREATE INDEX "RentalUnitAllocation_contractId_idx" ON "RentalUnitAllocation"("contractId");

-- CreateIndex
CREATE INDEX "RentalUnitAllocation_status_idx" ON "RentalUnitAllocation"("status");

-- CreateIndex
CREATE INDEX "RentalContract_tenantId_idx" ON "RentalContract"("tenantId");

-- CreateIndex
CREATE INDEX "RentalContract_clientId_idx" ON "RentalContract"("clientId");

-- CreateIndex
CREATE INDEX "RentalContract_status_idx" ON "RentalContract"("status");

-- CreateIndex
CREATE INDEX "RentalContract_startAt_endAt_idx" ON "RentalContract"("startAt", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "RentalContract_tenantId_contractNumber_key" ON "RentalContract"("tenantId", "contractNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RentalContract_tenantId_reservationId_key" ON "RentalContract"("tenantId", "reservationId");

-- CreateIndex
CREATE INDEX "RentalContractLine_contractId_idx" ON "RentalContractLine"("contractId");

-- CreateIndex
CREATE INDEX "RentalContractLine_rentalAssetId_idx" ON "RentalContractLine"("rentalAssetId");

-- CreateIndex
CREATE INDEX "RentalDeposit_tenantId_idx" ON "RentalDeposit"("tenantId");

-- CreateIndex
CREATE INDEX "RentalDeposit_contractId_idx" ON "RentalDeposit"("contractId");

-- CreateIndex
CREATE INDEX "RentalDeposit_clientId_idx" ON "RentalDeposit"("clientId");

-- CreateIndex
CREATE INDEX "RentalDeposit_status_idx" ON "RentalDeposit"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RentalDeposit_tenantId_idempotencyKey_key" ON "RentalDeposit"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "RentalDispatch_contractId_idx" ON "RentalDispatch"("contractId");

-- CreateIndex
CREATE INDEX "RentalDispatch_status_idx" ON "RentalDispatch"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RentalDispatch_tenantId_dispatchNumber_key" ON "RentalDispatch"("tenantId", "dispatchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RentalDispatch_tenantId_idempotencyKey_key" ON "RentalDispatch"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "RentalDispatchLine_dispatchId_idx" ON "RentalDispatchLine"("dispatchId");

-- CreateIndex
CREATE INDEX "RentalDispatchLine_rentalUnitId_idx" ON "RentalDispatchLine"("rentalUnitId");

-- CreateIndex
CREATE INDEX "RentalReturn_contractId_idx" ON "RentalReturn"("contractId");

-- CreateIndex
CREATE INDEX "RentalReturn_status_idx" ON "RentalReturn"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RentalReturn_tenantId_returnNumber_key" ON "RentalReturn"("tenantId", "returnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RentalReturn_tenantId_idempotencyKey_key" ON "RentalReturn"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "RentalReturnLine_returnId_idx" ON "RentalReturnLine"("returnId");

-- CreateIndex
CREATE INDEX "RentalReturnLine_rentalUnitId_idx" ON "RentalReturnLine"("rentalUnitId");

-- CreateIndex
CREATE INDEX "RentalInspection_tenantId_idx" ON "RentalInspection"("tenantId");

-- CreateIndex
CREATE INDEX "RentalInspection_returnId_idx" ON "RentalInspection"("returnId");

-- CreateIndex
CREATE INDEX "RentalInspection_rentalUnitId_idx" ON "RentalInspection"("rentalUnitId");

-- CreateIndex
CREATE INDEX "RentalCharge_contractId_idx" ON "RentalCharge"("contractId");

-- CreateIndex
CREATE INDEX "RentalCharge_approvalStatus_idx" ON "RentalCharge"("approvalStatus");

-- CreateIndex
CREATE INDEX "RentalCharge_billingStatus_idx" ON "RentalCharge"("billingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "RentalCharge_tenantId_idempotencyKey_key" ON "RentalCharge"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "RentalBillingPeriod_contractId_idx" ON "RentalBillingPeriod"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalBillingPeriod_tenantId_contractId_periodStart_periodE_key" ON "RentalBillingPeriod"("tenantId", "contractId", "periodStart", "periodEnd", "pricingVersion");

-- CreateIndex
CREATE UNIQUE INDEX "RentalBillingPeriod_tenantId_idempotencyKey_key" ON "RentalBillingPeriod"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "RentalUsageRecord_tenantId_idx" ON "RentalUsageRecord"("tenantId");

-- CreateIndex
CREATE INDEX "RentalUsageRecord_contractId_idx" ON "RentalUsageRecord"("contractId");

-- CreateIndex
CREATE INDEX "RentalUsageRecord_billingStatus_idx" ON "RentalUsageRecord"("billingStatus");

-- CreateIndex
CREATE INDEX "RentalExtension_tenantId_idx" ON "RentalExtension"("tenantId");

-- CreateIndex
CREATE INDEX "RentalExtension_contractId_idx" ON "RentalExtension"("contractId");

-- CreateIndex
CREATE INDEX "RentalExtension_status_idx" ON "RentalExtension"("status");

-- CreateIndex
CREATE INDEX "HireRequest_tenantId_idx" ON "HireRequest"("tenantId");

-- CreateIndex
CREATE INDEX "HireRequest_status_idx" ON "HireRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "HireRequest_tenantId_requestNumber_key" ON "HireRequest"("tenantId", "requestNumber");

-- CreateIndex
CREATE INDEX "HireAgreement_tenantId_idx" ON "HireAgreement"("tenantId");

-- CreateIndex
CREATE INDEX "HireAgreement_supplierId_idx" ON "HireAgreement"("supplierId");

-- CreateIndex
CREATE INDEX "HireAgreement_status_idx" ON "HireAgreement"("status");

-- CreateIndex
CREATE UNIQUE INDEX "HireAgreement_tenantId_agreementNumber_key" ON "HireAgreement"("tenantId", "agreementNumber");

-- CreateIndex
CREATE INDEX "HireDelivery_tenantId_idx" ON "HireDelivery"("tenantId");

-- CreateIndex
CREATE INDEX "HireDelivery_agreementId_idx" ON "HireDelivery"("agreementId");

-- CreateIndex
CREATE INDEX "HireUsageRecord_tenantId_idx" ON "HireUsageRecord"("tenantId");

-- CreateIndex
CREATE INDEX "HireUsageRecord_agreementId_idx" ON "HireUsageRecord"("agreementId");

-- CreateIndex
CREATE INDEX "HireUsageRecord_billingStatus_idx" ON "HireUsageRecord"("billingStatus");

-- CreateIndex
CREATE INDEX "HireSupplierDeposit_agreementId_idx" ON "HireSupplierDeposit"("agreementId");

-- CreateIndex
CREATE INDEX "HireSupplierDeposit_supplierId_idx" ON "HireSupplierDeposit"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "HireSupplierDeposit_tenantId_idempotencyKey_key" ON "HireSupplierDeposit"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "HireAccrual_agreementId_idx" ON "HireAccrual"("agreementId");

-- CreateIndex
CREATE UNIQUE INDEX "HireAccrual_tenantId_idempotencyKey_key" ON "HireAccrual"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "HireAccrual_tenantId_agreementId_periodStart_periodEnd_key" ON "HireAccrual"("tenantId", "agreementId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "RentalAsset_fixedAssetId_idx" ON "RentalAsset"("fixedAssetId");

-- CreateIndex
CREATE INDEX "RentalAsset_productId_idx" ON "RentalAsset"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalAsset_tenantId_code_key" ON "RentalAsset"("tenantId", "code");

-- AddForeignKey
ALTER TABLE "RentalUnit" ADD CONSTRAINT "RentalUnit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalUnit" ADD CONSTRAINT "RentalUnit_rentalAssetId_fkey" FOREIGN KEY ("rentalAssetId") REFERENCES "RentalAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalRatePlan" ADD CONSTRAINT "RentalRatePlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalRatePlan" ADD CONSTRAINT "RentalRatePlan_rentalAssetId_fkey" FOREIGN KEY ("rentalAssetId") REFERENCES "RentalAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalQuotation" ADD CONSTRAINT "RentalQuotation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalQuotationLine" ADD CONSTRAINT "RentalQuotationLine_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "RentalQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalQuotationLine" ADD CONSTRAINT "RentalQuotationLine_rentalAssetId_fkey" FOREIGN KEY ("rentalAssetId") REFERENCES "RentalAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalReservation" ADD CONSTRAINT "RentalReservation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalReservation" ADD CONSTRAINT "RentalReservation_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "RentalQuotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalUnitAllocation" ADD CONSTRAINT "RentalUnitAllocation_rentalUnitId_fkey" FOREIGN KEY ("rentalUnitId") REFERENCES "RentalUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalUnitAllocation" ADD CONSTRAINT "RentalUnitAllocation_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "RentalReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalUnitAllocation" ADD CONSTRAINT "RentalUnitAllocation_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "RentalContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalContract" ADD CONSTRAINT "RentalContract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalContract" ADD CONSTRAINT "RentalContract_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "RentalReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalContract" ADD CONSTRAINT "RentalContract_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "RentalQuotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalContractLine" ADD CONSTRAINT "RentalContractLine_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "RentalContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalContractLine" ADD CONSTRAINT "RentalContractLine_rentalAssetId_fkey" FOREIGN KEY ("rentalAssetId") REFERENCES "RentalAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalDeposit" ADD CONSTRAINT "RentalDeposit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalDeposit" ADD CONSTRAINT "RentalDeposit_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "RentalContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalDispatch" ADD CONSTRAINT "RentalDispatch_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "RentalContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalDispatchLine" ADD CONSTRAINT "RentalDispatchLine_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "RentalDispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalDispatchLine" ADD CONSTRAINT "RentalDispatchLine_rentalUnitId_fkey" FOREIGN KEY ("rentalUnitId") REFERENCES "RentalUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalReturn" ADD CONSTRAINT "RentalReturn_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "RentalContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalReturnLine" ADD CONSTRAINT "RentalReturnLine_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "RentalReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalReturnLine" ADD CONSTRAINT "RentalReturnLine_rentalUnitId_fkey" FOREIGN KEY ("rentalUnitId") REFERENCES "RentalUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalInspection" ADD CONSTRAINT "RentalInspection_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "RentalReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalInspection" ADD CONSTRAINT "RentalInspection_rentalUnitId_fkey" FOREIGN KEY ("rentalUnitId") REFERENCES "RentalUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalCharge" ADD CONSTRAINT "RentalCharge_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "RentalContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalCharge" ADD CONSTRAINT "RentalCharge_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "RentalReturn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalCharge" ADD CONSTRAINT "RentalCharge_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "RentalInspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalBillingPeriod" ADD CONSTRAINT "RentalBillingPeriod_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "RentalContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalUsageRecord" ADD CONSTRAINT "RentalUsageRecord_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "RentalContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalExtension" ADD CONSTRAINT "RentalExtension_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "RentalContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HireRequest" ADD CONSTRAINT "HireRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HireAgreement" ADD CONSTRAINT "HireAgreement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HireAgreement" ADD CONSTRAINT "HireAgreement_hireRequestId_fkey" FOREIGN KEY ("hireRequestId") REFERENCES "HireRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HireDelivery" ADD CONSTRAINT "HireDelivery_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "HireAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HireUsageRecord" ADD CONSTRAINT "HireUsageRecord_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "HireAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HireSupplierDeposit" ADD CONSTRAINT "HireSupplierDeposit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HireSupplierDeposit" ADD CONSTRAINT "HireSupplierDeposit_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "HireAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HireAccrual" ADD CONSTRAINT "HireAccrual_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "HireAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
