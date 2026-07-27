/**
 * Phase 16 — Offline fiscal envelope create → sign → verify → seal.
 * Sealed envelopes are immutable. No acceptance claim before upload.
 */

import crypto from 'crypto';
import {
  canonicalizeOfflinePayload,
  signOfflineFiscalEnvelope,
  verifyOfflineSignature,
} from './offlineSigner.js';
import { reserveOfflineFiscalNumber } from './offlineSequence.js';
import { resolveOfflineReceiptContract } from './offlineContractRegistry.js';
import { OfflineErrors } from './offlineErrors.js';
import { OFFLINE_ENVELOPE_STATE } from '../../domain/operationalEnums.js';

/**
 * Build, sign and seal an offline envelope from immutable snapshot evidence.
 */
export async function createAndSealOfflineEnvelope({
  tenantId,
  businessId,
  branchId = null,
  terminalId,
  agentId,
  deviceIdentity,
  environment = 'SANDBOX',
  mode = 'MOCK',
  fiscalSnapshotId,
  snapshotChecksum,
  snapshotPayload,
  configurationPackageId = 'cfg-mock-v1',
  mappingPackageId = 'map-mock-v1',
  limitPackageId = 'lim-mock-v1',
  connectivityEvidenceId = null,
  clockEvidenceId = null,
  browserContext = false,
} = {}) {
  if (browserContext) {
    throw OfflineErrors.browserProhibited();
  }
  if (!fiscalSnapshotId || !snapshotChecksum || !snapshotPayload) {
    throw OfflineErrors.saleReadiness({ message: 'Immutable snapshot evidence required.' });
  }

  const reservation = reserveOfflineFiscalNumber({
    tenantId,
    businessId,
    terminalId,
    agentId,
    environment,
    mode,
    fiscalSnapshotId,
  });

  const payload = {
    schemaVersion: 'offline-payload-v1',
    tenantId,
    businessId,
    terminalId,
    agentId,
    environment,
    fiscalSnapshotId,
    snapshotChecksum,
    offlineFiscalNumber: reservation.offlineFiscalNumber,
    offlineIndicator: true,
    onlineIndicator: false,
    transactionTimestamp: snapshotPayload.transactionTimestamp || new Date().toISOString(),
    sellerTin: snapshotPayload.sellerTin || null,
    currency: snapshotPayload.currency || 'MWK',
    grossTotal: String(snapshotPayload.grossTotal ?? '0'),
    taxTotal: String(snapshotPayload.taxTotal ?? '0'),
    levyTotal: String(snapshotPayload.levyTotal ?? '0'),
    lines: snapshotPayload.lines || [],
    configurationPackageId,
    mappingPackageId,
  };

  const canonicalBytes = canonicalizeOfflinePayload(payload);
  const canonicalPayloadChecksum = crypto.createHash('sha256').update(canonicalBytes).digest('hex');

  const signed = await signOfflineFiscalEnvelope({
    agentId,
    terminalId,
    environment,
    mode,
    exactCanonicalBytes: canonicalBytes,
    browserContext: false,
  });

  const verify = verifyOfflineSignature({
    exactCanonicalBytes: canonicalBytes,
    signature: signed.signature,
    environment,
    mode,
  });
  if (!verify.valid) {
    throw OfflineErrors.signatureVerification();
  }

  const receiptContract = resolveOfflineReceiptContract({ environment, mode });
  const receiptStatus = 'OFFLINE_UPLOAD_PENDING';
  const receiptWording = receiptContract.contract.pendingWording;

  const envelope = {
    id: crypto.randomUUID(),
    tenantId,
    businessId,
    branchId,
    terminalId,
    agentId,
    deviceIdentity,
    environment,
    fiscalSnapshotId,
    fiscalNumberAssignmentId: reservation.sequenceId,
    offlineFiscalNumber: reservation.offlineFiscalNumber,
    transactionTimestamp: payload.transactionTimestamp,
    configurationPackageId,
    mappingPackageId,
    limitPackageId,
    payloadSchemaVersion: 'offline-payload-v1',
    canonicalizationVersion: 'offline-canon-v1',
    signatureContractVersion: signed.signatureContractVersion,
    canonicalPayloadChecksum,
    signedBytesChecksum: signed.signedBytesChecksum,
    offlineSignature: signed.signature,
    signatureEncoding: signed.signatureEncoding,
    keyReference: signed.keyReference,
    keyVersion: signed.keyVersion,
    signatureVerified: true,
    connectivityEvidenceId,
    clockEvidenceId,
    state: OFFLINE_ENVELOPE_STATE.SEALED,
    sealedAt: new Date().toISOString(),
    immutable: true,
    receiptStatus,
    receiptWording,
    claimsMraAcceptance: false,
    inventedValidationUrl: false,
    version: 1,
  };

  const queueItem = {
    id: crypto.randomUUID(),
    tenantId,
    businessId,
    branchId,
    terminalId,
    agentId,
    environment,
    offlineEnvelopeId: envelope.id,
    fiscalSnapshotId,
    offlineFiscalNumber: envelope.offlineFiscalNumber,
    queueSequence: reservation.numericValue,
    queuePartitionKey: `${tenantId}:${businessId}:${terminalId}:${environment}`,
    state: 'SEALED',
    sealedChecksum: crypto
      .createHash('sha256')
      .update(`${envelope.id}:${envelope.canonicalPayloadChecksum}:${envelope.offlineSignature}`)
      .digest('hex'),
    payloadByteLength: canonicalBytes.length,
    uploadAttemptCount: 0,
    previousChecksum: null,
    createdAt: new Date().toISOString(),
    version: 1,
  };

  return {
    envelope,
    queueItem,
    reservation,
    accountingPosted: false, // caller owns once-only posting
    inventoryPosted: false,
    mraUploadPerformed: false,
    journalCreated: false,
    stockMovementCreated: false,
  };
}

/** Mutating a sealed envelope is prohibited. */
export function assertEnvelopeImmutable(envelope, proposedPatch = {}) {
  if (!envelope || envelope.state !== OFFLINE_ENVELOPE_STATE.SEALED) {
    return { ok: true };
  }
  const forbidden = [
    'offlineSignature',
    'offlineFiscalNumber',
    'fiscalSnapshotId',
    'canonicalPayloadChecksum',
    'signedBytesChecksum',
    'configurationPackageId',
    'mappingPackageId',
  ];
  const attempted = forbidden.filter((k) => Object.prototype.hasOwnProperty.call(proposedPatch, k));
  if (attempted.length) {
    throw OfflineErrors.tamper({
      message: 'Sealed offline envelope fields cannot be modified.',
      details: { attempted },
    });
  }
  return { ok: true };
}
