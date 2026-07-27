/**
 * Phase 16 — Trusted Agent registration / activation / heartbeat / suspension.
 * Bootstrap tokens expire; cashiers cannot activate agents.
 */

import crypto from 'crypto';
import prisma from '@/lib/prisma.js';
import {
  TRUSTED_AGENT_LIFECYCLE,
  TRUSTED_AGENT_TRUST,
  OFFLINE_DEPLOYMENT_ARCHITECTURE,
} from '../../domain/operationalEnums.js';
import { OfflineErrors } from './offlineErrors.js';

const BOOTSTRAP_TTL_MS = 15 * 60 * 1000;

function stableDeviceIdentityFromInstall({ installationId, agentInstanceId }) {
  // Cryptographic install-bound identity — not MAC, not container ID, not UA
  return crypto
    .createHash('sha256')
    .update(`mra-eis-device-id-v1|${installationId}|${agentInstanceId}`)
    .digest('hex');
}

export async function registerTrustedAgent({
  tenantId,
  businessId,
  branchId = null,
  siteMappingId = null,
  terminalId,
  environment = 'SANDBOX',
  agentType = 'DEVICE_AGENT',
  agentVersion = '0.0.0-mock',
  architecture = OFFLINE_DEPLOYMENT_ARCHITECTURE.CENTRAL_SERVER_WITH_DEVICE_AGENT,
  actorUserId = null,
  db = prisma,
} = {}) {
  if (!tenantId || !businessId || !terminalId) {
    throw OfflineErrors.capability({ message: 'tenantId, businessId and terminalId are required.' });
  }

  const installationId = crypto.randomUUID();
  const agentInstanceId = crypto.randomUUID();
  const stableDeviceIdentity = stableDeviceIdentityFromInstall({
    installationId,
    agentInstanceId,
  });
  const bootstrapToken = crypto.randomBytes(24).toString('base64url');
  const bootstrapExpiresAt = new Date(Date.now() + BOOTSTRAP_TTL_MS);

  const row = await db.mraEisTrustedAgent.create({
    data: {
      tenantId,
      businessId,
      branchId,
      siteMappingId,
      terminalId,
      environment,
      agentType,
      agentInstanceId,
      stableDeviceIdentity,
      deviceIdentityVersion: 'device-id-v1',
      agentVersion,
      architecture,
      lifecycleState: TRUSTED_AGENT_LIFECYCLE.AWAITING_ACTIVATION,
      trustState: TRUSTED_AGENT_TRUST.UNVERIFIED,
      bootstrapTokenHash: crypto.createHash('sha256').update(bootstrapToken).digest('hex'),
      bootstrapExpiresAt,
      versionPolicyState: 'SUPPORTED',
      createdBy: actorUserId,
    },
  });

  return {
    agent: sanitizeAgent(row),
    bootstrapToken,
    bootstrapExpiresAt,
    note: 'Bootstrap token is short-lived and must not become the permanent signing credential.',
  };
}

export async function activateTrustedAgent({
  tenantId,
  businessId,
  agentId,
  bootstrapToken,
  actorUserId = null,
  db = prisma,
} = {}) {
  const row = await db.mraEisTrustedAgent.findFirst({
    where: { id: agentId, tenantId, businessId },
  });
  if (!row) throw OfflineErrors.agentNotRegistered();

  if (!bootstrapToken || !row.bootstrapTokenHash || !row.bootstrapExpiresAt) {
    throw OfflineErrors.agentNotActive({ message: 'Bootstrap token required for activation.' });
  }
  if (new Date(row.bootstrapExpiresAt) < new Date()) {
    throw OfflineErrors.agentNotActive({ message: 'Bootstrap token expired.' });
  }
  const hash = crypto.createHash('sha256').update(bootstrapToken).digest('hex');
  if (hash !== row.bootstrapTokenHash) {
    throw OfflineErrors.agentNotActive({ message: 'Invalid bootstrap token.' });
  }

  const updated = await db.mraEisTrustedAgent.update({
    where: { id: row.id },
    data: {
      lifecycleState: TRUSTED_AGENT_LIFECYCLE.ACTIVE,
      trustState: TRUSTED_AGENT_TRUST.VERIFIED,
      activatedAt: new Date(),
      activatedBy: actorUserId,
      bootstrapTokenHash: null,
      bootstrapExpiresAt: null,
      signingKeyReference: `key-ref://${row.id}/offline-signing`,
      encryptionKeyReference: `key-ref://${row.id}/local-db`,
      version: { increment: 1 },
    },
  });

  return { agent: sanitizeAgent(updated) };
}

export async function recordAgentHeartbeat({
  tenantId,
  businessId,
  agentId,
  safeMetadata = {},
  db = prisma,
} = {}) {
  const row = await db.mraEisTrustedAgent.findFirst({
    where: { id: agentId, tenantId, businessId },
  });
  if (!row) throw OfflineErrors.agentNotRegistered();

  // Strip any accidental secrets
  const safe = {
    agentVersion: safeMetadata.agentVersion || row.agentVersion,
    connectivityState: safeMetadata.connectivityState || null,
    queueDepth: safeMetadata.queueDepth ?? null,
    oldestQueueItemAgeHours: safeMetadata.oldestQueueItemAgeHours ?? null,
    clockDriftMs: safeMetadata.clockDriftMs ?? null,
    storageHealthy: safeMetadata.storageHealthy ?? null,
    tamperStatus: safeMetadata.tamperStatus || 'OK',
  };

  const updated = await db.mraEisTrustedAgent.update({
    where: { id: row.id },
    data: {
      lastHeartbeatAt: new Date(),
      lastHeartbeatSafeJson: safe,
      version: { increment: 1 },
    },
  });

  return { agent: sanitizeAgent(updated), acceptedSafeMetadata: safe };
}

export async function suspendTrustedAgent({
  tenantId,
  businessId,
  agentId,
  reason,
  actorUserId = null,
  db = prisma,
} = {}) {
  const row = await db.mraEisTrustedAgent.findFirst({
    where: { id: agentId, tenantId, businessId },
  });
  if (!row) throw OfflineErrors.agentNotRegistered();

  const updated = await db.mraEisTrustedAgent.update({
    where: { id: row.id },
    data: {
      lifecycleState: TRUSTED_AGENT_LIFECYCLE.SUSPENDED,
      suspendedAt: new Date(),
      suspensionReason: reason || 'ADMIN_SUSPENSION',
      updatedBy: actorUserId,
      version: { increment: 1 },
    },
  });
  return { agent: sanitizeAgent(updated) };
}

export async function revokeTrustedAgent({
  tenantId,
  businessId,
  agentId,
  reason,
  lost = false,
  compromised = false,
  actorUserId = null,
  db = prisma,
} = {}) {
  const row = await db.mraEisTrustedAgent.findFirst({
    where: { id: agentId, tenantId, businessId },
  });
  if (!row) throw OfflineErrors.agentNotRegistered();

  const lifecycleState = compromised
    ? TRUSTED_AGENT_LIFECYCLE.COMPROMISED
    : lost
      ? TRUSTED_AGENT_LIFECYCLE.LOST
      : TRUSTED_AGENT_LIFECYCLE.REVOKED;

  const updated = await db.mraEisTrustedAgent.update({
    where: { id: row.id },
    data: {
      lifecycleState,
      trustState: compromised ? TRUSTED_AGENT_TRUST.COMPROMISED : TRUSTED_AGENT_TRUST.REVOKED,
      revokedAt: new Date(),
      suspensionReason: reason || lifecycleState,
      signingKeyReference: null, // revoke signing capability reference
      updatedBy: actorUserId,
      version: { increment: 1 },
    },
  });

  return {
    agent: sanitizeAgent(updated),
    newSignaturesBlocked: true,
    queuePreserved: true,
    numbersNotReused: true,
  };
}

export function sanitizeAgent(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    businessId: row.businessId,
    branchId: row.branchId,
    siteMappingId: row.siteMappingId,
    terminalId: row.terminalId,
    environment: row.environment,
    agentType: row.agentType,
    agentInstanceId: row.agentInstanceId,
    stableDeviceIdentity: row.stableDeviceIdentity,
    deviceIdentityVersion: row.deviceIdentityVersion,
    agentVersion: row.agentVersion,
    architecture: row.architecture,
    lifecycleState: row.lifecycleState,
    trustState: row.trustState,
    versionPolicyState: row.versionPolicyState,
    lastHeartbeatAt: row.lastHeartbeatAt,
    activatedAt: row.activatedAt,
    suspendedAt: row.suspendedAt,
    revokedAt: row.revokedAt,
    // never return bootstrap token hash or private keys
    hasSigningKeyReference: Boolean(row.signingKeyReference),
    inventedMacUsed: false,
    containerIdUsed: false,
  };
}
