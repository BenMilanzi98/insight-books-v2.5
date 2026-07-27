/**
 * Typed Phase 5 domain events — payloads must never contain secrets.
 */

function base(eventType, {
  tenantId,
  businessId = tenantId,
  aggregateId,
  aggregateVersion = 1,
  actorId = null,
  correlationId = null,
  requestId = null,
  payload = {},
}) {
  return Object.freeze({
    eventId: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    eventType,
    eventVersion: 1,
    tenantId,
    businessId,
    aggregateId,
    aggregateVersion,
    occurredAt: new Date().toISOString(),
    actorId,
    correlationId,
    requestId,
    payload: Object.freeze({ ...payload }),
  });
}

export const MraEisDomainEvents = {
  terminalCreated: (ctx) => base('MraEisTerminalCreated', ctx),
  terminalStateChanged: (ctx) => base('MraEisTerminalStateChanged', ctx),
  credentialReferenceCreated: (ctx) => base('MraEisCredentialReferenceCreated', ctx),
  configurationSnapshotCreated: (ctx) => base('MraEisConfigurationSnapshotCreated', ctx),
  configurationActivated: (ctx) => base('MraEisConfigurationActivated', ctx),
  siteMapped: (ctx) => base('MraEisSiteMapped', ctx),
  productMappingActivated: (ctx) => base('MraEisProductMappingActivated', ctx),
  taxMappingActivated: (ctx) => base('MraEisTaxMappingActivated', ctx),
  paymentMappingActivated: (ctx) => base('MraEisPaymentMappingActivated', ctx),
  fiscalSequenceReserved: (ctx) => base('MraEisFiscalSequenceReserved', ctx),
  snapshotCreated: (ctx) => base('MraEisSnapshotCreated', ctx),
  snapshotQueued: (ctx) => base('MraEisSnapshotQueued', ctx),
  transmissionCreated: (ctx) => base('MraEisTransmissionCreated', ctx),
  transmissionStateChanged: (ctx) => base('MraEisTransmissionStateChanged', ctx),
  transmissionAttemptRecorded: (ctx) => base('MraEisTransmissionAttemptRecorded', ctx),
  responseRecorded: (ctx) => base('MraEisResponseRecorded', ctx),
  receiptProjectionChanged: (ctx) => base('MraEisReceiptProjectionChanged', ctx),
  vat5ReservationCreated: (ctx) => base('MraEisVat5ReservationCreated', ctx),
  offlineEntryCreated: (ctx) => base('MraEisOfflineEntryCreated', ctx),
  reconciliationStarted: (ctx) => base('MraEisReconciliationStarted', ctx),
  reconciliationDifferenceFound: (ctx) => base('MraEisReconciliationDifferenceFound', ctx),
  manualReviewOpened: (ctx) => base('MraEisManualReviewOpened', ctx),
};
