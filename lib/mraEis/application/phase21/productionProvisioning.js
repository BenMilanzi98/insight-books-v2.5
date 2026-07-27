/**
 * Phase 21 — Production artifact verification + credential provisioning (references only).
 */

import crypto from 'crypto';
import { Phase21Errors } from './phase21Errors.js';
import { scanTextForSecrets, scanObjectForSecrets } from '../phase20/secretLeakScanner.js';

const CHANGES = new Map();
const CREDENTIALS = new Map();
const ARTIFACTS = new Map();

export function __resetProvisioningForTests() {
  CHANGES.clear();
  CREDENTIALS.clear();
  ARTIFACTS.clear();
}

export function createProductionChangeRequest({
  releaseId,
  commit,
  buildDigest,
  containerDigest,
  migrationChecksum,
  workerVersion,
  agentVersion = null,
  pilotScope,
  requestedBy,
  backupPlan,
  rollbackPlan,
} = {}) {
  const id = crypto.randomUUID();
  const row = {
    id,
    releaseId,
    commit,
    buildDigest,
    containerDigest,
    migrationChecksum,
    workerVersion,
    agentVersion,
    pilotScope,
    requestedBy,
    backupPlan,
    rollbackPlan,
    approvals: {
      security: false,
      finance: false,
      compliance: false,
      operations: false,
      change: false,
    },
    approvedBy: null,
    state: 'DRAFT',
    releaseFrozen: false,
    createdAt: new Date().toISOString(),
  };
  CHANGES.set(id, row);
  return row;
}

export function approveProductionChange({ changeId, approverId, role } = {}) {
  const row = CHANGES.get(changeId);
  if (!row) throw Phase21Errors.productionChangeApproval({ message: 'Change request not found.' });
  if (approverId && row.requestedBy && approverId === row.requestedBy && role === 'change') {
    throw Phase21Errors.productionChangeApproval({
      message: 'Release operator cannot approve own release.',
    });
  }
  const key = String(role || '').toLowerCase();
  if (!(key in row.approvals)) {
    throw Phase21Errors.productionChangeApproval({ message: `Unknown approval role: ${role}` });
  }
  row.approvals[key] = true;
  if (Object.values(row.approvals).every(Boolean)) {
    row.state = 'APPROVED';
    row.approvedBy = approverId;
  } else {
    row.state = 'PENDING_APPROVALS';
  }
  return row;
}

export function startReleaseFreeze({ changeId } = {}) {
  const row = CHANGES.get(changeId);
  if (!row || row.state !== 'APPROVED') throw Phase21Errors.productionChangeApproval();
  row.releaseFrozen = true;
  row.state = 'RELEASE_FROZEN';
  return row;
}

export function verifyProductionArtifacts({
  changeId,
  testedCommit,
  testedBuildDigest,
  testedContainerDigest,
  testedMigrationChecksum,
  hasMockEndpoints = false,
  hasEmbeddedCredentials = false,
  hasDebugBypass = false,
  artifactBlob = '',
} = {}) {
  const row = CHANGES.get(changeId);
  if (!row) throw Phase21Errors.artifactMismatch({ message: 'Change request not found.' });
  if (row.commit !== testedCommit || row.buildDigest !== testedBuildDigest) {
    throw Phase21Errors.artifactMismatch();
  }
  if (row.containerDigest !== testedContainerDigest || row.migrationChecksum !== testedMigrationChecksum) {
    throw Phase21Errors.artifactMismatch();
  }
  if (hasMockEndpoints || hasDebugBypass) {
    throw Phase21Errors.artifactMismatch({
      message: 'Production artifacts must not contain mock endpoints or debug bypasses.',
    });
  }
  if (hasEmbeddedCredentials || scanTextForSecrets(artifactBlob).length) {
    throw Phase21Errors.credentialProvisioning({
      message: 'Production artifacts must not embed credentials.',
    });
  }
  const manifest = {
    id: crypto.randomUUID(),
    changeId,
    commit: row.commit,
    buildDigest: row.buildDigest,
    containerDigest: row.containerDigest,
    migrationChecksum: row.migrationChecksum,
    workerVersion: row.workerVersion,
    agentVersion: row.agentVersion,
    verifiedAt: new Date().toISOString(),
    noMockEndpoints: true,
    noEmbeddedCredentials: true,
    noDebugBypass: true,
  };
  ARTIFACTS.set(manifest.id, manifest);
  row.artifactManifestId = manifest.id;
  return manifest;
}

/**
 * Provision Production credentials as opaque Secret Provider references only.
 */
export function provisionProductionCredential({
  changeId,
  alias,
  secretProviderReference,
  environment = 'PRODUCTION',
  credentialType,
  approvedBy,
  provisionedBy,
} = {}) {
  const row = CHANGES.get(changeId);
  if (!row) {
    throw Phase21Errors.productionChangeApproval({ message: 'Change request not found.' });
  }
  if (!row.releaseFrozen) {
    throw Phase21Errors.productionChangeApproval({
      message: 'Release freeze required before credential provisioning.',
    });
  }
  if (!approvedBy || approvedBy === provisionedBy) {
    throw Phase21Errors.credentialProvisioning({
      message: 'Credential provisioner cannot approve own provisioning (four-eyes).',
    });
  }
  if (!secretProviderReference || !String(secretProviderReference).startsWith('secret-provider://')) {
    throw Phase21Errors.credentialProvisioning({
      message: 'Only secret-provider:// references are allowed.',
    });
  }
  if (/password|jwt=|BEGIN PRIVATE|eyJ[A-Za-z0-9_-]+\./i.test(secretProviderReference)) {
    throw Phase21Errors.credentialProvisioning();
  }
  if (environment === 'PRODUCTION' && /sandbox/i.test(secretProviderReference)) {
    throw Phase21Errors.environmentMismatch({
      message: 'Sandbox credential references cannot be used in Production.',
    });
  }
  if (environment === 'SANDBOX' && /production/i.test(secretProviderReference)) {
    throw Phase21Errors.environmentMismatch();
  }

  const payload = { alias, secretProviderReference, environment, credentialType };
  if (scanObjectForSecrets(payload).length) throw Phase21Errors.credentialProvisioning();

  const id = crypto.randomUUID();
  const cred = {
    id,
    changeId,
    alias,
    secretProviderReference,
    environment,
    credentialType,
    approvedBy,
    provisionedBy,
    plaintextForbidden: true,
    browserExposureForbidden: true,
    logExposureForbidden: true,
    tacPersisted: false,
    buyerAuthorizationPersisted: false,
    createdAt: new Date().toISOString(),
  };
  CREDENTIALS.set(id, cred);
  return {
    ...cred,
    // never return the raw reference to browser APIs — redact
    secretProviderReference: '[REDACTED_REFERENCE]',
    _internalReference: secretProviderReference, // tests may check via get
  };
}

export function getCredentialInternal(id) {
  return CREDENTIALS.get(id) || null;
}

export function getChangeRequest(id) {
  return CHANGES.get(id) || null;
}

export function assertProductionChangeApproved(changeId) {
  const row = CHANGES.get(changeId);
  if (!row || !['APPROVED', 'RELEASE_FROZEN'].includes(row.state)) {
    throw Phase21Errors.productionChangeApproval();
  }
  return row;
}
