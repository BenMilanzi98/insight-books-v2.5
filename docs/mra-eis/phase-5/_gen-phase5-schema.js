/**
 * Emits Phase 5 Prisma model block + SQL migration.
 * Run: node docs/mra-eis/phase-5/_gen-phase5-schema.js
 */
import fs from 'fs';
import path from 'path';

const prismaBlock = `
// ─── MRA EIS Phase 5 — Operational persistence foundation ───
// No plaintext credentials. No FK cascade into fiscal evidence.
// businessId aliases tenantId (Tenant = Business) in Phase 5.

model MraEisTerminal {
  id                                   String    @id @default(cuid())
  tenantId                             String
  businessId                           String
  branchId                             String?
  siteMappingId                        String?
  environment                          String
  mraTerminalId                        String?
  terminalPosition                     String?
  terminalLabel                        String
  productId                            String?
  productVersion                       String?
  platformIdentityReference            String?
  status                               String    @default("DRAFT")
  previousStatus                       String?
  activationAttemptCount               Int       @default(0)
  activationRequestedAt                DateTime?
  activationResponseReceivedAt         DateTime?
  credentialsPersistedAt               DateTime?
  activationConfirmedAt                DateTime?
  activatedAt                          DateTime?
  tokenExpiresAt                       DateTime?
  currentCredentialReferenceId         String?
  activeGlobalConfigurationSnapshotId  String?
  activeTerminalConfigurationSnapshotId String?
  activeTaxpayerConfigurationSnapshotId String?
  lastConfigurationSyncAt              DateTime?
  lastSuccessfulContactAt              DateTime?
  lastOnlineAcceptedAt                 DateTime?
  lastOfflineAcceptedAt                DateTime?
  blockedAt                            DateTime?
  blockReason                          String?
  unblockCheckedAt                     DateTime?
  offlineCertified                     Boolean   @default(false)
  offlineMaximumAmount                 Decimal?  @db.Decimal(18, 2)
  offlineMaximumAgeHours               Int?
  version                              Int       @default(1)
  createdBy                            String?
  updatedBy                            String?
  createdAt                            DateTime  @default(now())
  updatedAt                            DateTime  @updatedAt
  retentionUntil                       DateTime?
  legalHold                            Boolean   @default(false)

  @@index([tenantId, businessId, status])
  @@index([tenantId, environment])
  @@index([businessId, status])
  @@index([mraTerminalId])
  @@unique([tenantId, businessId, environment, terminalLabel])
}

model MraEisCredentialReference {
  id                 String    @id @default(cuid())
  tenantId           String
  businessId         String
  terminalId         String
  environment        String
  credentialType     String
  provider           String    @default("PHASE6_VAULT")
  vaultReference     String
  keyVersion         String    @default("v0")
  status             String    @default("PENDING")
  createdAt          DateTime  @default(now())
  activatedAt        DateTime?
  expiresAt          DateTime?
  rotatedAt          DateTime?
  revokedAt          DateTime?
  replacedByReferenceId String?
  accessPolicyVersion String   @default("v1")
  metadataChecksum   String?
  createdByService   String
  version            Int       @default(1)

  @@index([tenantId, businessId, terminalId])
  @@index([terminalId, credentialType, status])
  @@unique([terminalId, credentialType, vaultReference])
}

model MraEisConfigurationSnapshot {
  id                     String    @id @default(cuid())
  tenantId               String
  businessId             String
  terminalId             String
  environment            String
  configurationType      String
  mraVersion             String
  schemaVersion          String    @default("1")
  contractVersion        String    @default("1")
  effectiveFrom          DateTime?
  receivedAt             DateTime  @default(now())
  validatedAt            DateTime?
  status                 String
  canonicalData          Json
  safeRawResponseReference String?
  sourceChecksum         String
  validationChecksum     String?
  validationErrors       Json?
  activatedAt            DateTime?
  supersededAt           DateTime?
  createdByService       String
  createdAt              DateTime  @default(now())
  retentionUntil         DateTime?
  legalHold              Boolean   @default(false)

  @@unique([terminalId, configurationType, mraVersion])
  @@index([tenantId, businessId, terminalId, status])
  @@index([terminalId, configurationType, status])
}

model MraEisConfigurationActivation {
  id                  String   @id @default(cuid())
  tenantId            String
  businessId          String
  terminalId          String
  configurationType   String
  previousSnapshotId  String?
  activatedSnapshotId String
  reason              String?
  activatedBy         String
  activatedAt         DateTime @default(now())
  correlationId       String?
  requestId           String?

  @@index([terminalId, configurationType, activatedAt])
  @@index([tenantId, businessId])
}

model MraEisSite {
  id                          String    @id @default(cuid())
  tenantId                    String
  businessId                  String
  terminalId                  String?
  environment                 String
  mraTin                      String
  mraSiteId                   String
  siteName                    String
  siteType                    String?
  addressLine1                String?
  addressLine2                String?
  city                        String?
  active                      Boolean   @default(true)
  sourceConfigurationSnapshotId String?
  sourceChecksum              String
  synchronizedAt              DateTime  @default(now())
  supersededAt                DateTime?
  createdAt                   DateTime  @default(now())
  updatedAt                   DateTime  @updatedAt

  @@unique([tenantId, businessId, environment, mraTin, mraSiteId])
  @@index([businessId, environment, active])
}

model MraEisSiteMapping {
  id                      String    @id @default(cuid())
  tenantId                String
  businessId              String
  branchId                String
  warehouseId             String?
  terminalId              String?
  mraSiteId               String
  status                  String
  effectiveFrom           DateTime  @default(now())
  effectiveTo             DateTime?
  sourceConfigurationVersion String?
  verifiedAt              DateTime?
  verifiedBy              String?
  reason                  String?
  version                 Int       @default(1)
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt

  @@index([tenantId, businessId, status])
  @@index([businessId, branchId, status])
  @@index([mraSiteId, status])
}

model MraEisExternalCatalogueItem {
  id               String    @id @default(cuid())
  tenantId         String
  businessId       String
  terminalId       String?
  environment      String
  mraTin           String
  mraSiteId        String
  externalType     String
  mraCode          String
  barcode          String?
  name             String
  description      String?
  unitOfMeasure    String?
  unitPrice        Decimal?  @db.Decimal(18, 2)
  costPrice        Decimal?  @db.Decimal(18, 2)
  sellingPrice     Decimal?  @db.Decimal(18, 2)
  quantity         Decimal?  @db.Decimal(18, 6)
  active           Boolean   @default(true)
  sourceVersion    String
  sourceChecksum   String
  synchronizedAt   DateTime  @default(now())
  supersededAt     DateTime?
  rawRecordReference String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@unique([tenantId, businessId, environment, mraSiteId, externalType, mraCode, sourceVersion])
  @@index([businessId, mraSiteId, active])
  @@index([mraCode])
}

model MraEisProductMapping {
  id                     String    @id @default(cuid())
  tenantId               String
  businessId             String
  branchId               String?
  localItemId            String?
  localServiceId         String?
  externalCatalogueItemId String
  mappingType            String
  status                 String
  unitConversionRule     String?
  taxMappingId           String?
  effectiveFrom          DateTime  @default(now())
  effectiveTo            DateTime?
  mappingVersion         Int       @default(1)
  verifiedAt             DateTime?
  verifiedBy             String?
  source                 String    @default("MANUAL")
  reason                 String?
  version                Int       @default(1)
  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt

  @@index([tenantId, businessId, status])
  @@index([localItemId, status])
  @@index([localServiceId, status])
  @@index([externalCatalogueItemId, status])
}

model MraEisTaxMapping {
  id                           String    @id @default(cuid())
  tenantId                     String
  businessId                   String
  terminalId                   String?
  localTaxRateId               String
  mraTaxRateId                 String
  chargeMode                   String?
  sourceConfigurationSnapshotId String?
  status                       String
  effectiveFrom                DateTime  @default(now())
  effectiveTo                  DateTime?
  mappingVersion               Int       @default(1)
  localRateSnapshot            Decimal   @db.Decimal(18, 6)
  mraRateSnapshot              Decimal   @db.Decimal(18, 6)
  differenceReason             String?
  verifiedAt                   DateTime?
  verifiedBy                   String?
  version                      Int       @default(1)
  createdAt                    DateTime  @default(now())
  updatedAt                    DateTime  @updatedAt

  @@index([tenantId, businessId, status])
  @@index([localTaxRateId, status])
  @@index([mraTaxRateId])
}

model MraEisLevyMapping {
  id                           String    @id @default(cuid())
  tenantId                     String
  businessId                   String
  localLevyId                  String
  mraLevyId                    String
  sourceConfigurationSnapshotId String?
  chargeMode                   String?
  status                       String
  effectiveFrom                DateTime  @default(now())
  effectiveTo                  DateTime?
  mappingVersion               Int       @default(1)
  localRateSnapshot            Decimal?  @db.Decimal(18, 6)
  mraRateSnapshot              Decimal?  @db.Decimal(18, 6)
  verifiedAt                   DateTime?
  verifiedBy                   String?
  version                      Int       @default(1)
  createdAt                    DateTime  @default(now())
  updatedAt                    DateTime  @updatedAt

  @@index([tenantId, businessId, status])
  @@index([localLevyId, status])
}

model MraEisPaymentMethodMapping {
  id                   String    @id @default(cuid())
  tenantId             String
  businessId           String
  localPaymentMethodId String
  mraPaymentMethodCode String
  environment          String
  status               String
  effectiveFrom        DateTime  @default(now())
  effectiveTo          DateTime?
  mappingVersion       Int       @default(1)
  verifiedAt           DateTime?
  verifiedBy           String?
  notes                String?
  version              Int       @default(1)
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  @@index([tenantId, businessId, status])
  @@index([localPaymentMethodId, status])
}

model MraEisFiscalSequence {
  id                   String   @id @default(cuid())
  tenantId             String
  businessId           String
  terminalId           String
  businessDate         DateTime @db.Date
  lastAllocatedSequence Int     @default(0)
  algorithmVersion     String   @default("UNVERIFIED_PHASE5")
  timezone             String   @default("Africa/Blantyre")
  version              Int      @default(1)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@unique([terminalId, businessDate])
  @@index([tenantId, businessId, terminalId])
}

model MraEisFiscalNumberAllocation {
  id                    String    @id @default(cuid())
  tenantId              String
  businessId            String
  terminalId            String
  snapshotId            String?
  businessDate          DateTime  @db.Date
  dailySequence         Int
  generatedFiscalNumber String?
  algorithmVersion      String    @default("UNVERIFIED_PHASE5")
  allocationStatus      String
  allocatedAt           DateTime  @default(now())
  allocatedByService    String
  correlationId         String?
  requestId             String?
  reason                String?

  @@unique([terminalId, businessDate, dailySequence])
  @@unique([generatedFiscalNumber])
  @@index([tenantId, businessId, terminalId])
  @@index([snapshotId])
}

model MraEisSnapshot {
  id                        String    @id @default(cuid())
  tenantId                  String
  businessId                String
  branchId                  String?
  terminalId                String
  siteMappingId             String?
  sourceType                String
  sourceId                  String
  sourceVersion             String
  sourceEventId             String?
  localDocumentNumber       String?
  journalEntryId            String?
  transactionDate           DateTime
  postingDate               DateTime
  businessDate              DateTime  @db.Date
  timezone                  String    @default("Africa/Blantyre")
  environment               String
  status                    String
  policyVersion             String
  apiContractVersion        String    @default("1")
  payloadMapperVersion      String    @default("1")
  fiscalNumberAllocationId  String?
  sellerTin                 String?
  sellerName                String?
  tradingName               String?
  buyerCustomerId           String?
  buyerName                 String?
  buyerTin                  String?
  currency                  String    @default("MWK")
  subtotal                  Decimal   @db.Decimal(18, 2)
  discountTotal             Decimal   @default(0) @db.Decimal(18, 2)
  taxTotal                  Decimal   @default(0) @db.Decimal(18, 2)
  levyTotal                 Decimal   @default(0) @db.Decimal(18, 2)
  invoiceTotal              Decimal   @db.Decimal(18, 2)
  amountTendered            Decimal?  @db.Decimal(18, 2)
  changeAmount              Decimal?  @db.Decimal(18, 2)
  configurationVersionSummary Json?
  mappingVersionSummary     Json?
  snapshotChecksum          String
  canonicalSnapshot         Json
  createdByService          String
  createdAt                 DateTime  @default(now())
  queuedAt                  DateTime?
  immutableAt               DateTime?
  version                   Int       @default(1)
  retentionUntil            DateTime?
  legalHold                 Boolean   @default(false)

  lines    MraEisSnapshotLine[]
  payments MraEisSnapshotPayment[]

  @@unique([sourceType, sourceId, sourceVersion, policyVersion])
  @@index([tenantId, businessId, businessDate])
  @@index([terminalId, status])
  @@index([journalEntryId])
  @@index([snapshotChecksum])
}

model MraEisSnapshotLine {
  id               String   @id @default(cuid())
  tenantId         String
  businessId       String
  snapshotId       String
  sequence         Int
  localSourceLineId String?
  localItemId      String?
  localServiceId   String?
  productMappingId String?
  mappingVersion   Int?
  mraCode          String?
  description      String
  isProduct        Boolean
  unitOfMeasure    String?
  quantity         Decimal  @db.Decimal(18, 6)
  unitPrice        Decimal  @db.Decimal(18, 2)
  discountAmount   Decimal  @default(0) @db.Decimal(18, 2)
  netAmount        Decimal  @db.Decimal(18, 2)
  taxAmount        Decimal  @default(0) @db.Decimal(18, 2)
  levyAmount       Decimal  @default(0) @db.Decimal(18, 2)
  grossAmount      Decimal  @db.Decimal(18, 2)
  taxMappingId     String?
  mraTaxRateId     String?
  levyMappingSummary Json?
  lineChecksum     String
  createdAt        DateTime @default(now())

  snapshot MraEisSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Restrict)

  @@unique([snapshotId, sequence])
  @@unique([snapshotId, localSourceLineId])
  @@index([tenantId, businessId, snapshotId])
}

model MraEisSnapshotPayment {
  id                     String   @id @default(cuid())
  tenantId               String
  businessId             String
  snapshotId             String
  sequence               Int
  localPaymentReferenceId String?
  paymentMethodMappingId String?
  localPaymentMethodId   String?
  mraPaymentMethodCode   String?
  amount                 Decimal  @db.Decimal(18, 2)
  amountTendered         Decimal? @db.Decimal(18, 2)
  changeAmount           Decimal? @db.Decimal(18, 2)
  isCreditComponent      Boolean  @default(false)
  paymentChecksum        String
  createdAt              DateTime @default(now())

  snapshot MraEisSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Restrict)

  @@unique([snapshotId, sequence])
  @@index([tenantId, businessId, snapshotId])
}

model MraEisTransmission {
  id                        String    @id @default(cuid())
  tenantId                  String
  businessId                String
  terminalId                String
  snapshotId                String
  fiscalNumberAllocationId  String?
  environment               String
  mode                      String
  status                    String
  previousStatus            String?
  attemptCount              Int       @default(0)
  currentAttemptId          String?
  firstQueuedAt             DateTime?
  claimedAt                 DateTime?
  claimedByWorker           String?
  claimExpiresAt            DateTime?
  lastAttemptAt             DateTime?
  nextAttemptAt             DateTime?
  acceptedAt                DateTime?
  rejectedAt                DateTime?
  unknownOutcomeAt          DateTime?
  reconciledAt              DateTime?
  validationUrl             String?
  mraApplicationStatus      String?
  mraRemark                 String?
  shouldRefreshConfiguration Boolean  @default(false)
  shouldBlockTerminal       Boolean   @default(false)
  latestResponseId          String?
  safeErrorCode             String?
  safeErrorSummary          String?
  manualReviewReason        String?
  idempotencyKey            String    @unique
  version                   Int       @default(1)
  createdAt                 DateTime  @default(now())
  updatedAt                 DateTime  @updatedAt
  retentionUntil            DateTime?
  legalHold                 Boolean   @default(false)

  @@unique([snapshotId, mode])
  @@index([tenantId, businessId, status])
  @@index([terminalId, status, nextAttemptAt])
  @@index([status, nextAttemptAt])
  @@index([snapshotId])
}

model MraEisTransmissionAttempt {
  id                        String    @id @default(cuid())
  tenantId                  String
  businessId                String
  transmissionId            String
  attemptNumber             Int
  endpointKey               String
  httpMethod                String    @default("POST")
  requestContractVersion    String    @default("1")
  requestChecksum           String
  responseChecksum          String?
  startedAt                 DateTime  @default(now())
  completedAt               DateTime?
  durationMilliseconds      Int?
  outcome                   String
  httpStatus                Int?
  mraApplicationStatus      String?
  safeErrorCode             String?
  safeErrorSummary          String?
  retryClassification       String
  workerId                  String?
  requestId                 String?
  correlationId             String?
  sanitizedRequestReference String?
  sanitizedResponseReference String?
  createdAt                 DateTime  @default(now())

  @@unique([transmissionId, attemptNumber])
  @@index([tenantId, businessId, transmissionId])
}

model MraEisResponse {
  id                         String   @id @default(cuid())
  tenantId                   String
  businessId                 String
  terminalId                 String
  transmissionId             String
  attemptId                  String
  environment                String
  httpStatus                 Int?
  mraApplicationStatus       String?
  remark                     String?
  responseCategory           String
  validationUrl              String?
  validationErrors           Json?
  shouldRefreshConfiguration Boolean  @default(false)
  shouldBlockTerminal        Boolean  @default(false)
  sourceChecksum             String
  sanitizedCanonicalResponse Json
  secureRawResponseReference String?
  receivedAt                 DateTime @default(now())
  contractVersion            String   @default("1")
  parserVersion              String   @default("1")
  createdAt                  DateTime @default(now())
  legalHold                  Boolean  @default(false)

  @@unique([attemptId])
  @@index([transmissionId])
  @@index([tenantId, businessId])
}

model MraEisReceiptProjection {
  id                  String    @id @default(cuid())
  tenantId            String
  businessId          String
  sourceType          String
  sourceId            String
  snapshotId          String?
  transmissionId      String?
  localDocumentNumber String?
  fiscalNumber        String?
  eisStatus           String
  validationUrl       String?
  qrContentChecksum   String?
  qrAssetReference    String?
  mode                String?
  terminalId          String?
  siteMappingId       String?
  sellerTin           String?
  acceptedAt          DateTime?
  projectionVersion   Int       @default(1)
  sourceEventVersion  String?
  rebuiltAt           DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@unique([sourceType, sourceId])
  @@index([tenantId, businessId, eisStatus])
  @@index([snapshotId])
}

model MraEisVat5Validation {
  id                  String    @id @default(cuid())
  tenantId            String
  businessId          String
  terminalId          String?
  customerId          String?
  projectNumber       String
  certificateNumber   String
  requestedQuantity   Decimal   @db.Decimal(18, 6)
  eligibleQuantity    Decimal?  @db.Decimal(18, 6)
  remainingQuantity   Decimal?  @db.Decimal(18, 6)
  status              String
  validationReference String?
  sourceChecksum      String?
  validatedAt         DateTime?
  expiresAt           DateTime?
  reservedQuantity    Decimal   @default(0) @db.Decimal(18, 6)
  consumedQuantity    Decimal   @default(0) @db.Decimal(18, 6)
  releasedQuantity    Decimal   @default(0) @db.Decimal(18, 6)
  snapshotId          String?
  version             Int       @default(1)
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@index([tenantId, businessId, status])
  @@index([certificateNumber])
  @@index([snapshotId])
}

model MraEisOfflineQueueEntry {
  id                         String    @id @default(cuid())
  tenantId                   String
  businessId                 String
  branchId                   String?
  terminalId                 String
  snapshotId                 String    @unique
  fiscalNumberAllocationId   String?
  status                     String
  offlineSignatureReference  String?
  offlineValidationUrl       String?
  snapshotChecksum           String
  queuedAt                   DateTime?
  originalTransactionDate    DateTime
  cumulativeAmountAtCreation Decimal   @db.Decimal(18, 2)
  maximumCumulativeAmount    Decimal   @db.Decimal(18, 2)
  oldestAllowedSubmissionAt  DateTime?
  uploadAttemptCount         Int       @default(0)
  lastUploadAttemptAt        DateTime?
  acceptedAt                 DateTime?
  safeErrorCode              String?
  version                    Int       @default(1)
  createdAt                  DateTime  @default(now())
  updatedAt                  DateTime  @updatedAt
  legalHold                  Boolean   @default(false)

  @@index([tenantId, businessId, status])
  @@index([terminalId, status])
}

model MraEisReconciliationRun {
  id                  String    @id @default(cuid())
  tenantId            String
  businessId          String
  terminalId          String?
  type                String
  status              String
  dateFrom            DateTime?
  dateTo              DateTime?
  startedAt           DateTime?
  completedAt         DateTime?
  initiatedBy         String
  initiationSource    String
  recordsExamined     Int       @default(0)
  differencesFound    Int       @default(0)
  criticalDifferences Int       @default(0)
  highDifferences     Int       @default(0)
  safeErrorCode       String?
  correlationId       String?
  requestId           String?
  version             Int       @default(1)
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  differences MraEisReconciliationDifference[]

  @@index([tenantId, businessId, status])
  @@index([type, createdAt])
}

model MraEisReconciliationDifference {
  id                         String    @id @default(cuid())
  tenantId                   String
  businessId                 String
  reconciliationRunId        String
  terminalId                 String?
  snapshotId                 String?
  transmissionId             String?
  differenceType             String
  severity                   String
  localValue                 String?
  externalValue              String?
  description                String
  status                     String    @default("OPEN")
  assignedTo                 String?
  resolvedBy                 String?
  resolvedAt                 DateTime?
  resolutionReason           String?
  resolutionEvidenceReference String?
  createdAt                  DateTime  @default(now())
  updatedAt                  DateTime  @updatedAt

  run MraEisReconciliationRun @relation(fields: [reconciliationRunId], references: [id], onDelete: Restrict)

  @@index([reconciliationRunId, severity, status])
  @@index([tenantId, businessId])
}

model MraEisSyncRun {
  id               String    @id @default(cuid())
  tenantId         String
  businessId       String
  terminalId       String?
  syncType         String
  environment      String
  status           String
  requestedAt      DateTime  @default(now())
  startedAt        DateTime?
  completedAt      DateTime?
  requestedBy      String
  sourceVersion    String?
  targetVersion    String?
  recordsReceived  Int       @default(0)
  recordsCreated   Int       @default(0)
  recordsUpdated   Int       @default(0)
  recordsUnchanged Int       @default(0)
  recordsRejected  Int       @default(0)
  warnings         Json?
  safeErrorCode    String?
  idempotencyKey   String    @unique
  correlationId    String?
  requestId        String?
  version          Int       @default(1)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@index([tenantId, businessId, syncType, status])
  @@index([terminalId, syncType, status])
}

model MraEisManualReviewCase {
  id               String    @id @default(cuid())
  tenantId         String
  businessId       String
  terminalId       String?
  caseType         String
  status           String    @default("OPEN")
  severity         String
  sourceEntityType String
  sourceEntityId   String
  title            String
  description      String
  assignedTo       String?
  openedBy         String
  openedAt         DateTime  @default(now())
  dueAt            DateTime?
  resolutionType   String?
  resolutionReason String?
  resolvedBy       String?
  resolvedAt       DateTime?
  approvalId       String?
  evidenceReference String?
  version          Int       @default(1)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@index([tenantId, businessId, status])
  @@index([caseType, status])
  @@index([sourceEntityType, sourceEntityId])
}

model MraEisAlertState {
  id                String    @id @default(cuid())
  tenantId          String
  businessId        String?
  terminalId        String?
  alertType         String
  severity          String
  deduplicationKey  String    @unique
  status            String    @default("ACTIVE")
  firstTriggeredAt  DateTime  @default(now())
  lastTriggeredAt   DateTime  @default(now())
  triggerCount      Int       @default(1)
  acknowledgedAt    DateTime?
  acknowledgedBy    String?
  resolvedAt        DateTime?
  resolvedBy        String?
  resolutionReason  String?
  sourceEntityType  String?
  sourceEntityId    String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([tenantId, status])
  @@index([alertType, status])
}

model MraEisOutbox {
  id              String    @id @default(cuid())
  tenantId        String
  businessId      String?
  aggregateType   String
  aggregateId     String
  eventType       String
  eventVersion    String    @default("1")
  payload         Json
  payloadChecksum String
  idempotencyKey  String    @unique
  status          String    @default("PENDING")
  availableAt     DateTime  @default(now())
  claimedAt       DateTime?
  claimExpiresAt  DateTime?
  claimedBy       String?
  processedAt     DateTime?
  attemptCount    Int       @default(0)
  nextAttemptAt   DateTime?
  safeErrorCode   String?
  requestId       String?
  correlationId   String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([status, availableAt])
  @@index([tenantId, businessId, eventType])
  @@index([aggregateType, aggregateId])
}
`;

const schemaPath = path.resolve('prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');
if (!schema.includes('model MraEisTerminal ')) {
  schema = schema.trimEnd() + '\n' + prismaBlock;
  fs.writeFileSync(schemaPath, schema);
  console.log('schema.prisma: appended Phase 5 models');
} else {
  console.log('schema.prisma: Phase 5 models already present');
}

// Build SQL from model names (simplified CREATE TABLE via prisma migrate would be better;
// we emit a hand-crafted migration matching the Prisma models).
console.log('Run prisma migrate to materialize SQL, or use companion migration SQL generator.');
fs.writeFileSync(
  path.resolve('docs/mra-eis/phase-5/_phase5_prisma_block.prisma.txt'),
  prismaBlock,
  'utf8'
);
console.log('wrote _phase5_prisma_block.prisma.txt');
