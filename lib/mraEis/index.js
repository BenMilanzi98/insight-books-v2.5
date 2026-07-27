/**
 * MraEis public API — Phases 4–13 (control plane through online Sales transmission).
 * Credentials never returned to browser. Suggestions never auto-activate.
 * Phase 11/12 create no Journal/Stock Movement.
 * Phase 13 may call mock/provisional Sales endpoint; production live transmission blocked.
 * Phase 13 does not generate QR images or final fiscal receipts.
 */

export * from './domain/constants.js';
export * from './domain/errors.js';
export * from './domain/permissions.js';
export * from './domain/stateMachines.js';
export {
  evaluateMraEisCapability,
  pausePolicyContract,
  disablementPolicyContract,
} from './policies/effectiveCapability.js';

export {
  getPlatformEisSetting,
  ensurePlatformEisSetting,
  updatePlatformEisStatus,
} from './application/platformService.js';

export {
  getCurrentEntitlement,
  listEntitlements,
  grantTenantEntitlement,
  upgradeTenantEntitlementToProduction,
  suspendTenantEntitlement,
  resumeTenantEntitlement,
  revokeTenantEntitlement,
  expireDueEntitlements,
} from './application/entitlementService.js';

export {
  getParticipation,
  optInTenantToEis,
  pauseTenantEisParticipation,
  resumeTenantEisParticipation,
  optOutTenantFromEis,
} from './application/participationService.js';

export {
  getBusinessEisSetting,
  listBusinessEisSettings,
  startBusinessEisSetup,
  resumeBusinessEisSetup,
  updateBusinessEisPreferences,
  enableBusinessEisOperation,
  pauseBusinessEisOperation,
  resumeBusinessEisOperation,
  disableBusinessEis,
} from './application/businessSettingService.js';

export {
  getLatestCertification,
  createCertificationRecord,
  verifyCertificationRecord,
  expireDueCertifications,
} from './application/certificationService.js';

export {
  evaluateTenantEisCapability,
  getEisReadinessSummary,
  canPerformEisOperation,
} from './application/capabilityService.js';

export { invalidateEisCapabilityCache } from './infrastructure/capabilityCache.js';

// Phase 5 — operational foundation
export * from './domain/operationalEnums.js';
export {
  transitionTerminal,
  transitionSnapshot,
  transitionTransmission,
  transitionConfiguration,
  assertOfflineCreationAllowed,
  TERMINAL_TRANSITIONS,
  SNAPSHOT_TRANSITIONS,
  TRANSMISSION_TRANSITIONS,
} from './domain/operationalStateMachines.js';
export * from './domain/valueObjects/index.js';

export {
  createDraftTerminal,
  transitionTerminalStatus,
  createCredentialReference,
} from './application/services/terminalService.js';
export { reserveFiscalSequence } from './application/services/fiscalSequenceService.js';
export {
  createFiscalSnapshot,
  queueFiscalSnapshot,
  assertSnapshotMutable,
} from './application/services/snapshotService.js';
export {
  createTransmission,
  queueTransmission,
  claimTransmission,
  appendTransmissionAttempt,
  transitionTransmissionStatus,
} from './application/services/transmissionService.js';
export { createOfflineQueueEntry } from './application/services/offlineQueueService.js';
export { createVat5Validation, reserveVat5Quantity } from './application/services/vat5Service.js';
export { runEisIntegrityChecks } from './application/services/integrityValidators.js';
export {
  appendEisOutboxEvent,
  claimEisOutboxBatch,
  markEisOutboxProcessed,
  recoverExpiredEisOutboxClaims,
} from './infrastructure/outbox/outboxService.js';

export {
  storeConfigurationSnapshot,
  markConfigurationValid,
  activateConfigurationSnapshot,
} from './application/services/configurationService.js';
export {
  upsertExternalCatalogueItem,
  createSiteMapping,
  createProductMapping,
  createTaxMapping,
  createPaymentMethodMapping,
  createLevyMapping,
} from './application/services/mappingService.js';
export {
  createReconciliationRun,
  appendReconciliationDifference,
  openManualReviewCase,
  createSyncRun,
} from './application/services/reconciliationService.js';
export {
  listBusinessTerminals,
  getTerminalByBusiness,
  getActiveConfigurations,
  getMappingCompleteness,
  getSnapshotBySourceIdentity,
  getTransmissionBySnapshot,
  listPendingTransmissions,
  listUnknownOutcomes,
  getOutboxHealth,
} from './application/services/queryService.js';
export { getEisFoundationDiagnostics } from './application/services/diagnosticsService.js';
export { MraEisDomainEvents } from './domain/events/index.js';
export { REPOSITORY_CONTRACTS } from './domain/repositories/contracts.js';
export {
  syntheticTenantPair,
  syntheticTerminalDraft,
  syntheticConfigurationCanonical,
  assertSyntheticSafe,
} from './infrastructure/fixtures/syntheticPhase5.js';

// Phase 6 — credential security
export { storeSecret, withSecret, storeEphemeralSecret, withEphemeralSecret, revokeSecret } from './security.js';

// Phase 7 — terminal onboarding / activation
export { evaluateTerminalActivationReadiness } from './application/activation/readinessService.js';
export { ensureStablePlatformIdentity } from './application/activation/platformIdentity.js';
export {
  createTerminalForOnboarding,
  submitTacForTerminal,
  runTerminalActivation,
  runTerminalConfirmation,
  safeTerminalDto,
} from './application/activation/activationOrchestrator.js';
export { getTerminalHealth, markExpiredTokens } from './application/activation/terminalHealthService.js';
export { requestTerminalReactivation } from './application/activation/reactivationService.js';
export { requestTerminalReplacement } from './application/activation/replacementService.js';
export {
  mapTerminalActivationRequest,
  mapConfirmationRequest,
} from './application/activation/activationMapper.js';
export {
  parseActivationResponse,
  parseConfirmationResponse,
} from './application/activation/activationResponseParser.js';
export { resetMockMraState, mockActivateTerminal, mockConfirmTerminal } from './infrastructure/mraClient/mockMraActivationServer.js';
export { getActivationMetricsSnapshot } from './application/activation/activationMetrics.js';

// Phase 8 — configuration synchronization
export {
  MraConfigurationTypeRegistry,
  CONFIGURATION_SYNC_ORDER,
  listRequiredConfigurationTypes,
} from './application/configuration/configurationTypeRegistry.js';
export { evaluateConfigurationSyncReadiness } from './application/configuration/syncReadinessService.js';
export {
  requestConfigurationSync,
  claimConfigurationSyncRun,
  executeConfigurationSyncRun,
  runConfigurationSyncNow,
} from './application/configuration/configurationSyncOrchestrator.js';
export { evaluateConfigurationFreshness, processingPauseContract } from './application/configuration/stalenessService.js';
export { getConfigurationHealth } from './application/configuration/configurationHealthService.js';
export { queueBeginningOfDayConfigurationSyncs, resolveBusinessDate } from './application/configuration/bodScheduler.js';
export {
  parseConfigurationResponse,
  compareConfigurationVersions,
} from './application/configuration/configResponseParser.js';
export {
  extractTaxDefinitions,
  extractLevyDefinitions,
  extractOfflineThresholds,
  extractReceiptConfiguration,
} from './application/configuration/configExtractors.js';
export {
  resetMockConfigState,
  setMockConfigScenario,
  mockGetConfiguration,
} from './infrastructure/mraClient/mockMraConfigurationServer.js';

// Phase 9 — site / tax / levy / payment mappings
export {
  MraMappingTypeRegistry,
  getMappingType,
  getSplitPaymentPolicy,
  isMappingTypeBlocked,
} from './application/mapping/mappingTypeRegistry.js';
export { evaluateSplitPaymentSupport } from './application/mapping/splitPaymentPolicy.js';
export {
  normalizeTaxTreatment,
  assertCompatibleTaxTreatments,
  inferTreatmentFromExternalCategory,
} from './application/mapping/taxTreatment.js';
export { validateBusinessTaxpayerIdentity } from './application/mapping/businessTaxpayerIdentity.js';
export {
  evaluateMraEisMappingReadiness,
  MAPPING_OPERATIONS,
} from './application/mapping/mappingReadiness.js';
export { listMraSites } from './application/mapping/siteCatalogue.js';
export {
  verifyMapping,
  approveMapping,
  activateMapping,
  supersedeMapping,
  markMappingsStale,
} from './application/mapping/mappingLifecycle.js';
export {
  resolveMraSiteForTransaction,
  resolveMraTaxForSaleLine,
  resolveMraLevyForSaleLine,
  resolveMraPaymentRepresentation,
  buildResolvedMappingSnapshot,
} from './application/mapping/resolutionServices.js';
export { calculateMraEisMappingCompleteness } from './application/mapping/mappingCompleteness.js';
export { discoverRequiredMappings } from './application/mapping/requiredMappingDiscovery.js';
export {
  generateBranchSiteSuggestions,
  generateTaxMappingSuggestions,
  generatePaymentMappingSuggestions,
} from './application/mapping/mappingSuggestions.js';
export { revalidateMappingsForConfigurationChange } from './application/mapping/mappingRevalidation.js';
export {
  createWarehouseMapping,
  evaluateWarehouseMappingRequirement,
} from './application/mapping/warehouseMapping.js';
export { evaluateTerminalSiteConsistency } from './application/mapping/terminalSiteConsistency.js';

// Phase 10 — Product/Service catalogue sync, mapping, inventory readiness
export {
  getProductSyncContractDecision,
  getServiceSyncContractDecision,
  getCatalogueReplacementDeltaPolicy,
  getInitialInventoryContractDecision,
} from './application/catalogue/productSyncContract.js';
export {
  classifyBusinessEisType,
  BUSINESS_EIS_TYPE,
} from './application/catalogue/businessTypeClassification.js';
export {
  evaluateCatalogueSyncReadiness,
  CATALOGUE_TYPES,
} from './application/catalogue/catalogueSyncReadiness.js';
export {
  requestCatalogueSync,
  claimCatalogueSyncRun,
  executeCatalogueSyncRun,
  runCatalogueSyncNow,
} from './application/catalogue/catalogueSyncOrchestrator.js';
export {
  mapProductCatalogueRequest,
  mapServiceCatalogueRequest,
} from './application/catalogue/catalogueRequestMappers.js';
export {
  parseCatalogueResponse,
  CATALOGUE_RESPONSE_OUTCOME,
} from './application/catalogue/catalogueResponseParser.js';
export {
  discoverLocalProducts,
  discoverLocalServices,
  discoverRequiredLocalItems,
} from './application/catalogue/localItemDiscovery.js';
export {
  generateProductMappingSuggestions,
  generateServiceMappingSuggestions,
} from './application/catalogue/productServiceSuggestions.js';
export {
  resolveMraProductForSaleLine,
  resolveMraServiceForSaleLine,
  buildResolvedItemMappingSnapshot,
} from './application/catalogue/productServiceResolution.js';
export { calculateProductServiceCompleteness } from './application/catalogue/productServiceCompleteness.js';
export {
  evaluateInitialMraInventoryRequirement,
  reconcileOpeningInventoryReadOnly,
  createInitialInventorySnapshot,
  approveInitialInventorySnapshot,
  submitInitialInventorySnapshot,
} from './application/catalogue/initialInventory.js';
export {
  buildUomConversionRule,
  convertQuantityToExternal,
} from './application/catalogue/uomMapping.js';
export {
  getBundlePolicy,
  getVariantPolicy,
  assertCrossTypeMappingAllowed,
} from './application/catalogue/crossTypeAndBundlePolicy.js';
export {
  resetMockCatalogueState,
  setMockCatalogueScenario,
  setMockInventoryScenario,
  mockGetCatalogue,
} from './infrastructure/mraClient/mockMraCatalogueServer.js';

// Phase 11 — sales eligibility + local transaction bridge
export * from './application/eligibility/index.js';

// Phase 12 — immutable fiscal snapshots + fiscal numbering (no MRA Sales submit)
export {
  evaluateFiscalSnapshotReadiness,
  READINESS_VERSION as FISCAL_SNAPSHOT_READINESS_VERSION,
} from './application/fiscalSnapshot/snapshotReadiness.js';
export {
  createFiscalSnapshotFromBridge,
  verifyFiscalSnapshotIntegrity,
  assertSnapshotMutable as assertFiscalSnapshotMutable,
  SALES_PAYLOAD_REQUESTED_EVENT,
} from './application/fiscalSnapshot/snapshotOrchestrator.js';
export {
  processFiscalSnapshotOutboxBatch,
  claimReadyBridgesForSnapshot,
} from './application/fiscalSnapshot/snapshotWorker.js';
export {
  resolveFiscalNumberContract,
  getMraEisFiscalNumberContractRegistry,
  getOnlineOfflineNumberPolicy,
  FISCAL_NUMBER_CONTRACT_VERSION,
  CONTRACT_STATUS as FISCAL_NUMBER_CONTRACT_STATUS,
} from './application/fiscalSnapshot/fiscalNumberContractRegistry.js';
export { resolveFiscalNumberScope } from './application/fiscalSnapshot/fiscalNumberScope.js';
export {
  ensureFiscalSequenceScope,
  reserveFiscalNumberAtomic,
  markReservationAssigned,
  reconcileFiscalSequenceScope,
  SEQUENCE_STATUS as FISCAL_SEQUENCE_STATUS,
  RESERVATION_STATUS as FISCAL_RESERVATION_STATUS,
} from './application/fiscalSnapshot/fiscalSequenceService.js';
export {
  getLastOnlineTransaction,
  getLastOfflineTransaction,
} from './application/fiscalSnapshot/lastTransactionAdapters.js';
export { FiscalSnapshotErrors } from './application/fiscalSnapshot/fiscalSnapshotErrors.js';
export {
  buildCanonicalFiscalSnapshot,
  buildSellerSnapshot,
  buildBuyerSnapshot,
} from './application/fiscalSnapshot/canonicalSnapshotBuilder.js';

// Phase 13 — online Sales payload mapping + secure transmission
export {
  getSalesEndpointContractRegistry,
  resolveSalesEndpointContract,
  getSalesEndpointContractDecision,
  SALES_CONTRACT_STATUS,
} from './application/salesTransmission/salesEndpointContractRegistry.js';
export {
  getSalesPayloadSchemaRegistry,
  getSalesResponseSchemaRegistry,
  SALES_PAYLOAD_SCHEMA_VERSION,
  SALES_MAPPER_VERSION,
} from './application/salesTransmission/salesPayloadSchemaRegistry.js';
export { evaluateOnlineSalesTransmissionReadiness } from './application/salesTransmission/transmissionReadiness.js';
export {
  mapFiscalSnapshotToSalesRequestV1,
  validateSalesPayloadV1,
} from './application/salesTransmission/salesPayloadMapper.js';
export {
  transmitFiscalSnapshotOnline,
  ACCEPTED_RECEIPT_REQUESTED_EVENT,
  TRANSMISSION_RECONCILIATION_REQUESTED_EVENT,
} from './application/salesTransmission/transmissionOrchestrator.js';
export { processSalesPayloadOutboxBatch } from './application/salesTransmission/transmissionWorker.js';
export {
  classifyHttpTransport,
  classifyApplicationStatus,
  APP_OUTCOME,
  TRANSPORT_CLASS,
  RETRY_CLASS,
} from './application/salesTransmission/applicationStatusClassifier.js';
export { generateSalesMessageHash } from './application/salesTransmission/salesMessageHash.js';
export { SalesTransmissionErrors } from './application/salesTransmission/salesTransmissionErrors.js';
export {
  mockSubmitSalesTransaction,
  setMockSalesScenario,
  resetMockSalesState,
  getMockSalesCallLog,
} from './infrastructure/mraClient/mockMraSalesServer.js';

// Phase 14 — fiscal receipts + validation QR from accepted evidence only
export {
  getReceiptContractRegistry,
  resolveReceiptContract,
  getReceiptContractDecision,
  RECEIPT_CONTRACT_STATUS,
  RECEIPT_TYPE,
} from './application/fiscalReceipt/receiptContractRegistry.js';
export {
  getQrSourceContractRegistry,
  resolveQrSourceContract,
  getQrSourceContractDecision,
  QR_SOURCE_TYPE,
  QR_CONTRACT_STATUS,
} from './application/fiscalReceipt/qrSourceContractRegistry.js';
export {
  getReceiptTemplateRegistry,
  resolveReceiptTemplate,
} from './application/fiscalReceipt/receiptTemplateRegistry.js';
export { evaluateFiscalReceiptGenerationReadiness } from './application/fiscalReceipt/fiscalReceiptReadiness.js';
export { validateMraValidationUrl } from './application/fiscalReceipt/validationUrlSecurity.js';
export { resolveQrSource } from './application/fiscalReceipt/qrSourceResolution.js';
export { generateAndVerifyQr, decodePngQr, QR_GENERATOR_VERSION } from './application/fiscalReceipt/qrCodeGenerator.js';
export { buildImmutableReceiptData } from './application/fiscalReceipt/receiptDataBuilder.js';
export {
  renderPos80Html,
  renderFiscalHtmlView,
  renderSalesInvoiceA4Pdf,
  evaluatePos58Support,
} from './application/fiscalReceipt/receiptRenderer.js';
export { generateFiscalReceiptFromAcceptedTransmission } from './application/fiscalReceipt/fiscalReceiptOrchestrator.js';
export { processAcceptedReceiptOutboxBatch } from './application/fiscalReceipt/fiscalReceiptWorker.js';
export { verifyFiscalReceiptIntegrity } from './application/fiscalReceipt/receiptIntegrity.js';
export { requestFiscalReceiptReprint } from './application/fiscalReceipt/receiptReprint.js';
export { FiscalReceiptErrors } from './application/fiscalReceipt/fiscalReceiptErrors.js';
export {
  readArtifactBytes,
  getReceiptStorageRoot,
} from './application/fiscalReceipt/receiptArtifactStorage.js';

// Phase 15 — reconciliation, safe retry, recovery
export {
  getLastTransactionContractRegistry,
  resolveLastTransactionContract,
  getLastTransactionContractDecision,
  LAST_TX_CONTRACT_STATUS,
  LAST_TX_ENDPOINT_TYPE,
} from './application/reconciliation/lastTransactionContractRegistry.js';
export {
  evaluateRetryPolicyDecision,
  getRetryPolicyRegistry,
  computeBackoffDelayMs,
  RETRY_DECISION,
  RETRY_POLICY_VERSION,
} from './application/reconciliation/retryPolicyRegistry.js';
export {
  classifyRejectedRemediation,
  getRejectedRemediationRegistry,
  REMEDIATION_CLASS,
} from './application/reconciliation/rejectedRemediationRegistry.js';
export { classifyDispatchCertainty, isDefinitelyNotSent } from './application/reconciliation/dispatchCertainty.js';
export { loadLocalReconciliationEvidence } from './application/reconciliation/localEvidence.js';
export {
  compareLocalAndMraEvidence,
  normalizeMraReconciliationEvidence,
} from './application/reconciliation/localMraComparator.js';
export {
  mockQueryLastOnlineTransaction,
  setMockLastTransactionScenario,
  resetMockLastTransactionState,
  seedMockLastTransaction,
  getMockLastTransactionCallLog,
} from './application/reconciliation/mockLastTransactionServer.js';
export { reconcileTransmissionOutcome } from './application/reconciliation/reconciliationOrchestrator.js';
export { processTransmissionReconciliationOutboxBatch } from './application/reconciliation/reconciliationWorker.js';
export {
  evaluateSafeRetryAuthorization,
  executeControlledSafeRetry,
} from './application/reconciliation/controlledSafeRetry.js';
export { processAuthorizedRetryBatch } from './application/reconciliation/retryScheduler.js';
export {
  recoverMissingPhase14Event,
  recoverMissingFiscalReceipt,
  recoverMissingReconciliationEvents,
} from './application/reconciliation/missingEvidenceRecovery.js';
export { reconcileFiscalSequenceEvidence } from './application/reconciliation/sequenceReconciliation.js';
export {
  getCircuitBreakerState,
  recordCircuitFailure,
  recordCircuitSuccess,
  runSafeCircuitProbe,
} from './application/reconciliation/circuitBreaker.js';
export { ReconciliationErrors } from './application/reconciliation/reconciliationErrors.js';

// Phase 16 — certified offline EIS
export {
  getOfflineContractDecision,
  getOfflineContractRegistries,
  resolveOfflineModeContract,
  resolveOfflineSignatureContract,
  resolveOfflineNumberingContract,
  resolveOfflineReceiptContract,
  resolveOfflineUploadContract,
  OFFLINE_CONTRACT_STATUS,
} from './application/offline/offlineContractRegistry.js';
export {
  evaluateOfflineCertification,
  certificationBlocksNewOfflineSales,
} from './application/offline/offlineCertificationPolicy.js';
export { evaluateEffectiveOfflineCapability } from './application/offline/effectiveOfflineCapability.js';
export {
  evaluateConnectivityTransition,
  assertNotBrowserOnlineAuthoritative,
} from './application/offline/connectivityStateMachine.js';
export { evaluateClockTrust } from './application/offline/clockIntegrity.js';
export { evaluateOfflineLimits } from './application/offline/offlineLimits.js';
export { evaluateOfflineSaleReadiness } from './application/offline/offlineSaleReadiness.js';
export {
  canonicalizeOfflinePayload,
  signOfflineFiscalEnvelope,
  verifyOfflineSignature,
} from './application/offline/offlineSigner.js';
export {
  reserveOfflineFiscalNumber,
  getOrInitOfflineSequence,
  explainOfflineSequence,
  __resetOfflineSequencesForTests,
} from './application/offline/offlineSequence.js';
export {
  createAndSealOfflineEnvelope,
  assertEnvelopeImmutable,
} from './application/offline/offlineEnvelope.js';
export {
  verifyQueuePartitionIntegrity,
  assertQueueIntegrityOrThrow,
  linkQueueItem,
} from './application/offline/queueIntegrity.js';
export { processOrderedOfflineUploadPartition } from './application/offline/offlineUploadWorker.js';
export {
  mockOfflineUpload,
  setMockOfflineUploadScenario,
  resetMockOfflineUploadState,
  getMockOfflineUploadCallLog,
} from './application/offline/mockOfflineMraServer.js';
export {
  registerTrustedAgent,
  activateTrustedAgent,
  recordAgentHeartbeat,
  suspendTrustedAgent,
  revokeTrustedAgent,
  sanitizeAgent,
} from './application/offline/trustedAgentService.js';
export {
  evaluateBrowserOfflineAuthoritativeRequest,
  denyBrowserForceOfflineEntry,
  LEGACY_BROWSER_OFFLINE_CLASSIFICATION,
} from './application/offline/browserOfflineQuarantine.js';
export { OfflineErrors } from './application/offline/offlineErrors.js';

// Phase 17 — terminal blocking, restrictions, unblock, revalidation
export {
  RESTRICTION_CONTRACT_STATUS,
  RESTRICTION_SOURCE,
  RESTRICTION_SCOPE,
  RESTRICTION_STATE,
  RESTRICTION_REASON,
  PRECEDENCE_ORDER,
  getReasonMeta,
  pickPrimaryRestriction,
  getRestrictionSourceRegistry,
  getMraBlockUnblockContractDecision,
  COMPLIANCE_OPERATION,
  evaluateCapabilityAgainstRestrictions,
  evaluateEffectiveComplianceCapabilities,
  ingestRestriction,
  listActiveRestrictions,
  clearRestriction,
  buildTerminalComplianceProjection,
  assertOperationAllowed,
  __resetRestrictionsForTests,
  UNBLOCK_REQUEST_STATE,
  createUnblockRequest,
  submitUnblockEvidence,
  approveUnblockRequest,
  queryUnblockStatus,
  applyClearanceAndRevalidate,
  classifyPendingOnlineWork,
  classifyPendingOfflineWork,
  __resetUnblockRequestsForTests,
  REVALIDATION_STATE,
  RESTORATION_STAGES,
  runPostUnblockRevalidation,
  queryMockUnblockStatus,
  queryMockBlockStatus,
  listMockUnblockScenarios,
  processRestrictionIngestEvent,
  processUnblockStatusJob,
  processRevalidationJob,
  __resetRestrictionWorkerClaimsForTests,
  activatePlatformEmergencyPause,
  clearPlatformEmergencyPause,
  RestrictionErrors,
} from './application/restrictions/index.js';

// Phase 18 — unified EIS Administration Centre (UI/ops layer; no fiscal engine)
export {
  AdminErrors,
  EIS_STATUS,
  FRESHNESS,
  resolveStatus,
  environmentBadge,
  transmissionOutcomeStatus,
  resolveEisAdminContext,
  buildContextBarModel,
  EIS_ADMIN_SECTIONS,
  SYSTEM_EIS_ADMIN_SECTIONS,
  ALLOWED_ADMIN_COMMANDS,
  assertNoFinalStateMutation,
  prepareAdminCommand,
  highRiskConfirmationPayload,
  __resetAdminCommandIdempotencyForTests,
  aggregateTenantEisOverview,
  aggregatePlatformEisOverview,
  buildDashboardCacheKey,
  HEALTH_DOMAIN,
  calculateHealthScorecard,
  REPORT_DEFINITIONS,
  getReportDefinition,
  listReportDefinitions,
  buildReportTraceability,
  reconcileReportTotals,
  EXPORT_STATE,
  sanitizeExportCell,
  sanitizeExportFilename,
  assertExportPermissions,
  createExportJob,
  generateExportJob,
  downloadExportJob,
  listExportJobs,
  __resetExportJobsForTests,
  searchEisEntities,
  __resetSearchRateForTests,
  VIEW_VISIBILITY,
  createSavedView,
  openSavedView,
  __resetSavedViewsForTests,
  upsertReadModel,
  getReadModel,
  rebuildReadModel,
  invalidateTenantReadModels,
  __resetReadModelsForTests,
  SLA_TARGETS,
  evaluateSla,
} from './application/admin/index.js';

// Phase 19 — Existing-data discovery, assessment, dry-run, additive migration
export {
  MigrationErrors,
  SOURCE_TYPE,
  SOURCE_STATUS,
  registerSourceSystem,
  getSourceSystem,
  listSourceSystems,
  createExtractionManifest,
  getExtractionManifest,
  assertSourceChecksumUnchanged,
  profileDataset,
  __resetMigrationSourcesForTests,
  OWNERSHIP_OUTCOME,
  ENVIRONMENT_CLASS,
  resolveTenantOwnership,
  resolveBusinessOwnership,
  classifyEnvironment,
  DUPLICATE_CLASS,
  INTEGRITY_BAND,
  detectDuplicates,
  detectOrphans,
  scoreIntegrity,
  MIGRATION_DECISION,
  SALE_CLASSIFICATION,
  detectCredentialLeak,
  classifySaleOrInvoice,
  evaluateMigrationCandidate,
  assertHistoricalTransmissionBlocked,
  RUN_MODE,
  RUN_STATE,
  RECORD_STATE,
  COHORTS,
  createMigrationRun,
  getMigrationRun,
  executeDryRun,
  approveMigrationRun,
  executeControlledMigration,
  rollbackMigrationRun,
  buildReconciliationSummary,
  __resetMigrationRunsForTests,
  FORBIDDEN_HOOKS,
  runInMigrationContext,
  isMigrationContext,
  assertHookAllowed,
  assertNoJournalFromMigration,
  assertNoStockMovementFromMigration,
  assertNoTransmissionFromMigration,
  assessTerminal,
  assessConfiguration,
  assessReceipt,
  assessOffline,
  assessFiscalNumber,
} from './application/migration/index.js';

// Phase 20 — Release readiness, registries, secret scan, gates
export {
  AUTOMATION_STATUS,
  ACCEPTANCE_CRITERIA,
  listAcceptanceCriteria,
  summarizeAcceptanceCoverage,
  ARCHITECTURE_INVARIANTS,
  listArchitectureInvariants,
  validateArchitectureInvariants,
  RELEASE_DECISION,
  evaluateMraEisReleaseReadiness,
  scanTextForSecrets,
  scanPathsForSecrets,
  scanObjectForSecrets,
  buildSyntheticTenantSet,
  buildSyntheticTerminals,
  buildSyntheticTransactions,
  assertSyntheticFixturesSafe,
  DEFECT_SEVERITY,
  DEFECT_STATE,
  registerDefect,
  updateDefect,
  listDefects,
  summarizeDefects,
  seedPhase20CarryForwardBlockers,
  __resetDefectsForTests,
} from './application/phase20/index.js';

// Phase 21 — Certification, pilot, cohort rollout, hypercare, BAU
export {
  Phase21Errors,
  CERTIFICATION_REVIEW_STATE,
  buildCertificationEvidencePackage,
  createCertificationReviewCase,
  transitionCertificationReview,
  recordCertificationOutcome,
  getCertificationReview,
  getCertificationOutcome,
  assertCertificationAllowsProduction,
  __resetCertificationForTests,
  createProductionChangeRequest,
  approveProductionChange,
  startReleaseFreeze,
  verifyProductionArtifacts,
  provisionProductionCredential,
  getCredentialInternal,
  getChangeRequest,
  assertProductionChangeApproved,
  __resetProvisioningForTests,
  PILOT_DECISION,
  definePilotScope,
  evaluatePilotEntryCriteria,
  recordPilotTransactionResult,
  evaluatePilotOutcome,
  getPilot,
  __resetPilotsForTests,
  DEFAULT_COHORTS,
  createRolloutPlan,
  evaluateCohortReadiness,
  enableCohortMember,
  verifyCohortPostEnable,
  pauseRollout,
  listCohorts,
  __resetCohortsForTests,
  startHypercare,
  recordDailyHypercareReport,
  updateHypercareHealth,
  evaluateHypercareExit,
  completeBauHandover,
  getHypercare,
  __resetHypercareForTests,
  PHASE21_PROGRAMME_STATUS,
  revalidatePhase20ReleaseGate,
  evaluatePhase21ProgrammeStatus,
} from './application/phase21/index.js';

