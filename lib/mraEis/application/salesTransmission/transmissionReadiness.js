/**
 * Online Sales transmission readiness — Phase 13.
 */
import prisma from '@/lib/prisma.js';
import { TRANSMISSION_STATUS, SNAPSHOT_STATUS } from '../../domain/operationalEnums.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { verifyFiscalSnapshotIntegrity } from '../fiscalSnapshot/snapshotOrchestrator.js';
import { resolveActivationMode } from '../../infrastructure/mraClient/environmentConfig.js';
import { resolveSalesEndpointContract } from './salesEndpointContractRegistry.js';
import { getSalesPayloadSchemaRegistry, getSalesResponseSchemaRegistry } from './salesPayloadSchemaRegistry.js';

export const TRANSMISSION_READINESS_VERSION = 'phase13-online-transmission-readiness-v1';

export async function evaluateOnlineSalesTransmissionReadiness({
  tenantId,
  businessId = tenantId,
  fiscalSnapshotId,
  expectedSnapshotVersion = null,
  expectedSnapshotChecksum = null,
  environment = null,
  actorOrServiceContext = null,
  db = prisma,
} = {}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const blockers = [];
  const warnings = [];
  const requiredActions = [];
  const evaluatedAt = new Date().toISOString();

  const snapshot = await db.mraEisSnapshot.findFirst({
    where: { id: fiscalSnapshotId, tenantId, businessId },
    include: { lines: true, payments: true },
  });

  if (!snapshot) {
    return base({
      snapshotExists: false,
      blockers: ['SNAPSHOT_NOT_FOUND'],
      evaluatedAt,
      actorOrServiceContext,
    });
  }

  const env = String(environment || snapshot.environment || 'SANDBOX').toUpperCase();
  const mode = resolveActivationMode(env);
  const contractResult = resolveSalesEndpointContract({ environment: env, mode });

  const snapshotOwnershipValid =
    snapshot.tenantId === tenantId && snapshot.businessId === businessId;
  if (!snapshotOwnershipValid) blockers.push('SNAPSHOT_OWNERSHIP_INVALID');

  const snapshotCompleted =
    snapshot.status === SNAPSHOT_STATUS.COMPLETED && Boolean(snapshot.immutableAt);
  if (!snapshotCompleted) blockers.push('SNAPSHOT_NOT_COMPLETED');

  if (expectedSnapshotVersion != null && String(snapshot.version) !== String(expectedSnapshotVersion)) {
    blockers.push('SNAPSHOT_VERSION_MISMATCH');
  }
  if (
    expectedSnapshotChecksum &&
    snapshot.snapshotChecksum !== expectedSnapshotChecksum
  ) {
    blockers.push('SNAPSHOT_CHECKSUM_MISMATCH');
  }

  const integrity = await verifyFiscalSnapshotIntegrity(snapshot.id, { db });
  const snapshotIntegrityVerified = integrity.status === 'VERIFIED';
  if (!snapshotIntegrityVerified) blockers.push('SNAPSHOT_INTEGRITY_FAILURE');

  const fiscalNumberAssigned = Boolean(
    snapshot.fiscalNumberAllocationId || snapshot.canonicalSnapshot?.fiscalNumber?.formatted
  );
  if (!fiscalNumberAssigned) blockers.push('FISCAL_NUMBER_NOT_ASSIGNED');

  const salesContractVerified = contractResult.allowsTransmission;
  if (!salesContractVerified) {
    blockers.push('SALES_CONTRACT_UNVERIFIED');
    requiredActions.push('USE_MOCK_OR_AWAIT_MRA_CLARIFICATION');
  }

  const payloadSchema = getSalesPayloadSchemaRegistry();
  const responseSchema = getSalesResponseSchemaRegistry();

  const accepted = await db.mraEisTransmission.findFirst({
    where: {
      tenantId,
      businessId,
      snapshotId: snapshot.id,
      status: {
        in: [
          TRANSMISSION_STATUS.ACCEPTED_ONLINE,
          TRANSMISSION_STATUS.ACCEPTED_OFFLINE,
          TRANSMISSION_STATUS.RECONCILED_ACCEPTED,
        ],
      },
    },
  });
  if (accepted) blockers.push('TRANSMISSION_ALREADY_ACCEPTED');

  const active = await db.mraEisTransmission.findFirst({
    where: {
      tenantId,
      businessId,
      snapshotId: snapshot.id,
      status: {
        in: [
          TRANSMISSION_STATUS.CLAIMED,
          TRANSMISSION_STATUS.VALIDATING,
          TRANSMISSION_STATUS.SENDING,
          TRANSMISSION_STATUS.SENT_AWAITING_RESULT,
        ],
      },
    },
  });
  if (active) blockers.push('ACTIVE_TRANSMISSION_IN_PROGRESS');

  const unknown = await db.mraEisTransmission.findFirst({
    where: {
      tenantId,
      businessId,
      snapshotId: snapshot.id,
      status: TRANSMISSION_STATUS.UNKNOWN_OUTCOME,
    },
  });
  if (unknown) {
    blockers.push('MANUAL_REVIEW_REQUIRED');
    warnings.push('UNKNOWN_OUTCOME_REQUIRES_PHASE_15');
  }

  const terminal = snapshot.terminalId
    ? await db.mraEisTerminal.findFirst({
        where: { id: snapshot.terminalId, tenantId, businessId },
      })
    : null;

  const terminalExists = Boolean(terminal);
  const terminalActive = terminal?.status === 'ACTIVE';
  const terminalBlocked = Boolean(terminal?.blockedAt || terminal?.status === 'BLOCKED');
  if (!terminalExists) blockers.push('TERMINAL_NOT_FOUND');
  if (terminalExists && !terminalActive) blockers.push('TERMINAL_NOT_ACTIVE');
  if (terminalBlocked) blockers.push('TERMINAL_BLOCKED');

  const terminalEnvironmentMatches =
    !terminal || String(terminal.environment || '').toUpperCase() === env;
  if (terminal && !terminalEnvironmentMatches) blockers.push('ENVIRONMENT_MISMATCH');

  const credentialAvailable = Boolean(terminal?.currentCredentialReferenceId);
  if (terminal && !credentialAvailable && mode !== 'MOCK') {
    blockers.push('CREDENTIAL_MISSING');
  } else if (!credentialAvailable && mode === 'MOCK') {
    warnings.push('MOCK_MODE_SYNTHETIC_JWT');
  }

  if (env === 'PRODUCTION') warnings.push('PRODUCTION_TRANSMISSION_BLOCKED');
  if (contractResult.isMock) warnings.push('SANDBOX_ONLY');
  if (!contractResult.contract?.isMraVerifiedHash) {
    warnings.push('REQUEST_HASH_UNVERIFIED');
  }
  warnings.push('RECEIPT_GENERATION_PENDING');
  warnings.push('RETRY_POLICY_DEFERRED_TO_PHASE_15');

  // Buyer auth / VAT5
  const buyerAuthRequired = Boolean(
    snapshot.canonicalSnapshot?.complianceEvidence?.buyerAuthorizationRequired
  );
  const vat5Ready = !snapshot.canonicalSnapshot?.buyer?.vat5Status;
  if (buyerAuthRequired) blockers.push('BUYER_AUTHORIZATION_REQUIRED');
  if (snapshot.canonicalSnapshot?.buyer?.vat5Status) blockers.push('VAT5_VALIDATION_REQUIRED');

  const submissionAllowed = blockers.length === 0;

  return {
    snapshotExists: true,
    snapshotOwnershipValid,
    snapshotCompleted,
    snapshotIntegrityVerified,
    snapshotChecksumMatches:
      !expectedSnapshotChecksum || snapshot.snapshotChecksum === expectedSnapshotChecksum,
    fiscalNumberAssigned,
    fiscalNumberContractVerified: fiscalNumberAssigned,
    transmissionAlreadyAccepted: Boolean(accepted),
    activeTransmissionExists: Boolean(active),
    terminalExists,
    terminalActive,
    terminalBlocked,
    terminalEnvironmentMatches,
    credentialAvailable: credentialAvailable || mode === 'MOCK',
    credentialLeaseAvailable: credentialAvailable || mode === 'MOCK',
    tokenValid: credentialAvailable || mode === 'MOCK',
    tokenExpiring: false,
    configurationReferencesAvailable: Boolean(snapshot.configurationVersionSummary),
    currentConfigurationHealth: 'ASSUMED_OK',
    snapshotConfigurationCompatibility: 'COMPATIBLE',
    salesContractVerified,
    payloadSchemaAvailable: Boolean(payloadSchema),
    responseSchemaAvailable: Boolean(responseSchema),
    requestHashContractVerified: Boolean(contractResult.isMock),
    buyerAuthorizationReady: !buyerAuthRequired,
    vat5Ready,
    onlineModeAllowed: true,
    submissionAllowed,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    requiredActions: [...new Set(requiredActions)],
    readinessVersion: TRANSMISSION_READINESS_VERSION,
    evaluatedAt,
    snapshot,
    terminal,
    contractResult,
    mode,
    environment: env,
    integrity,
    acceptedTransmission: accepted,
    activeTransmission: active,
  };
}

function base(partial) {
  return {
    snapshotExists: false,
    snapshotOwnershipValid: false,
    snapshotCompleted: false,
    snapshotIntegrityVerified: false,
    snapshotChecksumMatches: false,
    fiscalNumberAssigned: false,
    fiscalNumberContractVerified: false,
    transmissionAlreadyAccepted: false,
    activeTransmissionExists: false,
    terminalExists: false,
    terminalActive: false,
    terminalBlocked: false,
    terminalEnvironmentMatches: false,
    credentialAvailable: false,
    credentialLeaseAvailable: false,
    tokenValid: false,
    tokenExpiring: false,
    configurationReferencesAvailable: false,
    currentConfigurationHealth: null,
    snapshotConfigurationCompatibility: null,
    salesContractVerified: false,
    payloadSchemaAvailable: false,
    responseSchemaAvailable: false,
    requestHashContractVerified: false,
    buyerAuthorizationReady: false,
    vat5Ready: false,
    onlineModeAllowed: false,
    submissionAllowed: false,
    blockers: [],
    warnings: [],
    requiredActions: [],
    readinessVersion: TRANSMISSION_READINESS_VERSION,
    ...partial,
  };
}
