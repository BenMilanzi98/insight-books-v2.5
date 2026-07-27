/**
 * Phase 5 repository contracts (scoped methods only).
 * Implementations live in infrastructure/persistence/*.js
 *
 * Forbidden patterns:
 * - findById(id) without tenant/business scope
 * - updateStatus(id, status) without version
 * - deleteAcceptedTransmission
 * - saveSecretPlaintext
 * - listAllTenantsData
 */

export const REPOSITORY_CONTRACTS = Object.freeze({
  MraEisTerminalRepository: [
    'findByIdForBusiness',
    'findByLabelForBusiness',
    'insertDraft',
    'saveWithExpectedVersion',
  ],
  MraEisCredentialReferenceRepository: [
    'findActiveForTerminal',
    'insertReference',
    'rotateReference',
  ],
  MraEisConfigurationRepository: [
    'findByVersion',
    'insertIfAbsent',
    'activateConfiguration',
    'findActiveByType',
  ],
  MraEisSiteRepository: ['upsertExternalSite', 'findByMraSiteId'],
  MraEisSiteMappingRepository: [
    'findActiveMappingAtDate',
    'insertMapping',
    'saveWithExpectedVersion',
  ],
  MraEisExternalCatalogueRepository: ['insertIfAbsent', 'findByCode'],
  MraEisProductMappingRepository: [
    'findActiveMappingAtDate',
    'insertMapping',
    'saveWithExpectedVersion',
  ],
  MraEisTaxMappingRepository: ['findActiveMappingAtDate', 'insertMapping'],
  MraEisLevyMappingRepository: ['findActiveMappingAtDate', 'insertMapping'],
  MraEisPaymentMappingRepository: ['findActiveMappingAtDate', 'insertMapping'],
  MraEisFiscalSequenceRepository: ['reserveFiscalSequence'],
  MraEisFiscalAllocationRepository: ['appendAllocation', 'findByDailySequence'],
  MraEisSnapshotRepository: [
    'findBySourceIdentity',
    'insertSnapshot',
    'markQueuedImmutable',
  ],
  MraEisTransmissionRepository: [
    'findBySnapshotAndMode',
    'insertIfAbsent',
    'claimNextForTerminal',
    'saveWithExpectedVersion',
  ],
  MraEisTransmissionAttemptRepository: ['appendAttempt'],
  MraEisResponseRepository: ['appendResponse'],
  MraEisReceiptProjectionRepository: ['upsertProjection', 'rebuildProjection'],
  MraEisVat5Repository: ['reserveQuantity', 'findByIdForBusiness'],
  MraEisOfflineQueueRepository: ['insertIfCertified', 'findBySnapshot'],
  MraEisReconciliationRepository: ['createRun', 'appendDifference'],
  MraEisSyncRunRepository: ['insertIfAbsent', 'saveWithExpectedVersion'],
  MraEisManualReviewRepository: ['openCase', 'resolveCase'],
  MraEisAlertRepository: ['upsertAlertState'],
  MraEisOutboxRepository: ['appendOutboxEvent', 'claimNextBatch', 'recoverExpiredClaims'],
});
