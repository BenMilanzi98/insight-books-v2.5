/**
 * Phase 17 — Restriction aggregate: ingest, idempotency, projection, clearance.
 * Multiple restrictions coexist. Clearing one does not clear others.
 */

import crypto from 'crypto';
import prisma from '@/lib/prisma.js';
import {
  RESTRICTION_STATE,
  RESTRICTION_SOURCE,
  RESTRICTION_SCOPE,
  getReasonMeta,
  pickPrimaryRestriction,
} from './restrictionRegistries.js';
import { evaluateEffectiveComplianceCapabilities, COMPLIANCE_OPERATION } from './effectiveComplianceCapability.js';
import { RestrictionErrors } from './restrictionErrors.js';

/** In-memory store for unit tests */
const MEMORY = new Map();

function memKey(tenantId, businessId) {
  return `${tenantId}:${businessId}`;
}

function ensureMem(tenantId, businessId) {
  const k = memKey(tenantId, businessId);
  if (!MEMORY.has(k)) MEMORY.set(k, []);
  return MEMORY.get(k);
}

export function __resetRestrictionsForTests() {
  MEMORY.clear();
}

export function buildRestrictionIdentity({
  sourceType,
  sourceReference,
  reasonCode,
  scopeType,
  scopeId,
  environment,
  evidenceChecksum,
}) {
  return crypto
    .createHash('sha256')
    .update(
      [sourceType, sourceReference, reasonCode, scopeType, scopeId, environment, evidenceChecksum || ''].join('|')
    )
    .digest('hex');
}

/**
 * Ingest or reuse a restriction. Never deletes history.
 */
export async function ingestRestriction({
  tenantId = null,
  businessId = null,
  branchId = null,
  siteMappingId = null,
  terminalId = null,
  trustedAgentId = null,
  deviceId = null,
  environment = 'SANDBOX',
  sourceType,
  sourceReference,
  reasonCode,
  scopeType,
  scopeId,
  evidence = {},
  severity = null,
  useMemory = false,
  db = prisma,
} = {}) {
  if (!sourceType || !reasonCode || !scopeType || !scopeId || !environment) {
    throw RestrictionErrors.operationBlocked({
      message: 'Restriction requires source, reason, scope and environment.',
    });
  }

  const meta = getReasonMeta(reasonCode);
  const evidenceChecksum =
    evidence.checksum ||
    crypto.createHash('sha256').update(JSON.stringify(evidence.safe || evidence)).digest('hex');

  const identityKey = buildRestrictionIdentity({
    sourceType,
    sourceReference: sourceReference || 'NONE',
    reasonCode,
    scopeType,
    scopeId,
    environment,
    evidenceChecksum,
  });

  const payload = {
    tenantId,
    businessId,
    branchId,
    siteMappingId,
    terminalId,
    trustedAgentId,
    deviceId,
    environment,
    sourceType,
    sourceReference: sourceReference || null,
    reasonCode,
    scopeType,
    scopeId: String(scopeId),
    severity: severity || meta.severity,
    state: RESTRICTION_STATE.ACTIVE,
    identityKey,
    evidenceChecksum,
    evidenceJson: {
      schemaVersion: 'restriction-evidence-v1',
      ...evidence,
      // never store credentials
      jwt: undefined,
      privateKey: undefined,
      terminalSecret: undefined,
      buyerAuthorizationCode: undefined,
    },
    clearAuthority: meta.clearAuthority,
    autoExpire: Boolean(meta.autoExpire),
    effectiveFrom: new Date(),
    detectedAt: new Date(),
    version: 1,
  };

  if (useMemory || process.env.MRA_EIS_RESTRICTION_MEMORY === '1') {
    const list = ensureMem(tenantId || 'platform', businessId || 'platform');
    const existing = list.find(
      (r) =>
        r.identityKey === identityKey &&
        ['ACTIVE', 'ACKNOWLEDGED', 'REMEDIATION_PENDING', 'UNBLOCK_REQUEST_PENDING'].includes(r.state)
    );
    if (existing) {
      if (existing.evidenceChecksum !== evidenceChecksum) {
        throw RestrictionErrors.idempotencyConflict();
      }
      return { restriction: existing, created: false, duplicated: true };
    }
    const row = { id: crypto.randomUUID(), ...payload, createdAt: new Date(), updatedAt: new Date() };
    list.push(row);
    return { restriction: row, created: true, duplicated: false };
  }

  const existing = await db.mraEisRestriction.findFirst({
    where: {
      identityKey,
      state: {
        in: [
          RESTRICTION_STATE.ACTIVE,
          RESTRICTION_STATE.ACKNOWLEDGED,
          RESTRICTION_STATE.REMEDIATION_PENDING,
          RESTRICTION_STATE.UNBLOCK_REQUEST_PENDING,
        ],
      },
    },
  });
  if (existing) {
    if (existing.evidenceChecksum !== evidenceChecksum) {
      throw RestrictionErrors.idempotencyConflict();
    }
    return { restriction: existing, created: false, duplicated: true };
  }

  const created = await db.mraEisRestriction.create({ data: payload });
  return { restriction: created, created: true, duplicated: false };
}

export async function listActiveRestrictions({
  tenantId,
  businessId,
  terminalId = null,
  environment = null,
  useMemory = false,
  db = prisma,
} = {}) {
  const activeStates = [
    RESTRICTION_STATE.ACTIVE,
    RESTRICTION_STATE.ACKNOWLEDGED,
    RESTRICTION_STATE.REMEDIATION_PENDING,
    RESTRICTION_STATE.UNBLOCK_REQUEST_PENDING,
    RESTRICTION_STATE.CLEARANCE_PENDING_VERIFICATION,
  ];

  if (useMemory || process.env.MRA_EIS_RESTRICTION_MEMORY === '1') {
    const list = ensureMem(tenantId || 'platform', businessId || 'platform');
    return list.filter(
      (r) =>
        activeStates.includes(r.state) &&
        (!terminalId || r.terminalId === terminalId || r.scopeType === RESTRICTION_SCOPE.PLATFORM) &&
        (!environment || r.environment === environment)
    );
  }

  return db.mraEisRestriction.findMany({
    where: {
      OR: [
        { tenantId, businessId },
        { scopeType: RESTRICTION_SCOPE.PLATFORM, tenantId: null },
      ],
      state: { in: activeStates },
      ...(terminalId
        ? {
            OR: [
              { terminalId },
              { scopeType: { in: [RESTRICTION_SCOPE.PLATFORM, RESTRICTION_SCOPE.TENANT, RESTRICTION_SCOPE.BUSINESS] } },
            ],
          }
        : {}),
      ...(environment ? { environment } : {}),
    },
    orderBy: { detectedAt: 'desc' },
    take: 100,
  });
}

/**
 * Clear a restriction only with matching authority + evidence.
 * Does NOT set Terminal ACTIVE and does NOT clear other restrictions.
 */
export async function clearRestriction({
  tenantId,
  businessId,
  restrictionId,
  clearAuthority,
  clearanceEvidence = {},
  actorId = null,
  useMemory = false,
  db = prisma,
} = {}) {
  let row;
  if (useMemory || process.env.MRA_EIS_RESTRICTION_MEMORY === '1') {
    const list = ensureMem(tenantId || 'platform', businessId || 'platform');
    row = list.find((r) => r.id === restrictionId);
  } else {
    row = await db.mraEisRestriction.findFirst({
      where: { id: restrictionId, tenantId, businessId },
    });
  }
  if (!row) throw RestrictionErrors.operationBlocked({ message: 'Restriction not found.' });

  const meta = getReasonMeta(row.reasonCode);
  if (clearAuthority === 'TENANT' && meta.clearAuthority === 'MRA') {
    throw RestrictionErrors.terminalMraBlocked();
  }
  if (meta.clearAuthority === 'MRA' && clearAuthority !== 'MRA') {
    throw RestrictionErrors.unblockAuthorityMismatch({
      message: 'MRA restrictions require verified MRA clearance authority.',
    });
  }
  if (meta.clearAuthority === 'SECURITY' && clearAuthority !== 'SECURITY') {
    throw RestrictionErrors.unblockAuthorityMismatch();
  }

  const proven =
    clearanceEvidence.applicationStatus === 'TERMINAL_CLEARED' ||
    clearanceEvidence.applicationStatus === 'CLEARED' ||
    clearanceEvidence.cleared === true ||
    (clearAuthority === 'PLATFORM' && clearanceEvidence.platformClearanceApproved === true) ||
    (clearAuthority === 'SECURITY' && clearanceEvidence.incidentClosed === true) ||
    (clearAuthority === 'SEQUENCE' && clearanceEvidence.sequenceReconciled === true) ||
    (clearAuthority === 'QUEUE' && clearanceEvidence.queueIntegrityVerified === true) ||
    (clearAuthority === 'CONFIGURATION' && clearanceEvidence.configurationRefreshed === true) ||
    (clearAuthority === 'CERTIFICATION' && clearanceEvidence.certificationValid === true) ||
    (clearAuthority === 'TENANT_OR_BUSINESS' && clearanceEvidence.businessResumeApproved === true);

  if (!proven) {
    throw RestrictionErrors.clearanceNotProven({
      message: 'Clearance evidence insufficient. HTTP 200 alone is not clearance.',
    });
  }

  const updated = {
    ...row,
    state: RESTRICTION_STATE.CLEARED,
    clearedAt: new Date(),
    clearedBy: actorId,
    clearAuthority,
    clearanceEvidenceJson: {
      ...clearanceEvidence,
      jwt: undefined,
      privateKey: undefined,
    },
    version: (row.version || 1) + 1,
    updatedAt: new Date(),
  };

  if (useMemory || process.env.MRA_EIS_RESTRICTION_MEMORY === '1') {
    Object.assign(row, updated);
    return { restriction: row, terminalSetActive: false };
  }

  const saved = await db.mraEisRestriction.update({
    where: { id: row.id },
    data: {
      state: RESTRICTION_STATE.CLEARED,
      clearedAt: new Date(),
      clearedBy: actorId,
      clearAuthority,
      clearanceEvidenceJson: updated.clearanceEvidenceJson,
      version: { increment: 1 },
    },
  });
  return { restriction: saved, terminalSetActive: false };
}

export async function buildTerminalComplianceProjection({
  tenantId,
  businessId,
  terminalId,
  environment = 'SANDBOX',
  useMemory = false,
  db = prisma,
} = {}) {
  const restrictions = await listActiveRestrictions({
    tenantId,
    businessId,
    terminalId,
    environment,
    useMemory,
    db,
  });
  const { primary, secondary } = pickPrimaryRestriction(restrictions);
  const capability = evaluateEffectiveComplianceCapabilities({
    tenantId,
    businessId,
    terminalId,
    environment,
    requestedOperation: COMPLIANCE_OPERATION.FINALIZE_EIS_SALE,
    restrictions,
  });

  return {
    tenantId,
    businessId,
    terminalId,
    environment,
    effectiveState: capability.effectiveState,
    primaryRestrictionId: primary?.id || null,
    primaryReasonCode: primary?.reasonCode || null,
    primarySafeText: primary ? getReasonMeta(primary.reasonCode).safeText : null,
    secondaryReasonCodes: secondary.map((r) => r.reasonCode),
    activeRestrictionCount: restrictions.length,
    activeCriticalCount: restrictions.filter((r) => getReasonMeta(r.reasonCode).severity === 'CRITICAL').length,
    mraBlocked: restrictions.some((r) => r.reasonCode === 'MRA_TERMINAL_BLOCKED'),
    platformPaused: restrictions.some((r) => r.reasonCode === 'PLATFORM_EMERGENCY_PAUSE'),
    capabilities: capability.capabilities,
    canFinalizeEisSale: capability.capabilities[COMPLIANCE_OPERATION.FINALIZE_EIS_SALE],
    canTransmitOnline: capability.capabilities[COMPLIANCE_OPERATION.TRANSMIT_ONLINE],
    canRetryTransmission: capability.capabilities[COMPLIANCE_OPERATION.RETRY_ONLINE],
    canAllocateFiscalNumber: capability.capabilities[COMPLIANCE_OPERATION.ALLOCATE_FISCAL_NUMBER],
    canEnterOffline: capability.capabilities[COMPLIANCE_OPERATION.ENTER_OFFLINE],
    canCreateOfflineSale: capability.capabilities[COMPLIANCE_OPERATION.CREATE_OFFLINE_SALE],
    canSignOfflineEnvelope: capability.capabilities[COMPLIANCE_OPERATION.SIGN_OFFLINE_ENVELOPE],
    canUploadOfflineQueue: capability.capabilities[COMPLIANCE_OPERATION.UPLOAD_OFFLINE_QUEUE],
    canRunReconciliation: capability.capabilities[COMPLIANCE_OPERATION.RUN_RECONCILIATION],
    canSyncConfiguration: capability.capabilities[COMPLIANCE_OPERATION.SYNC_CONFIGURATION],
    canQueryBlockStatus: capability.capabilities[COMPLIANCE_OPERATION.QUERY_BLOCK_STATUS],
    canViewAcceptedReceipt: capability.capabilities[COMPLIANCE_OPERATION.VIEW_ACCEPTED_RECEIPT],
    canReprintAcceptedReceipt: capability.capabilities[COMPLIANCE_OPERATION.REPRINT_ACCEPTED_RECEIPT],
    misleadingActiveForbidden: true,
    evaluatedAt: new Date().toISOString(),
    policyVersion: 'terminal-compliance-projection-v1',
  };
}

export async function assertOperationAllowed({
  tenantId,
  businessId,
  terminalId,
  environment,
  requestedOperation,
  useMemory = false,
} = {}) {
  const restrictions = await listActiveRestrictions({
    tenantId,
    businessId,
    terminalId,
    environment,
    useMemory,
  });
  const result = evaluateEffectiveComplianceCapabilities({
    tenantId,
    businessId,
    terminalId,
    environment,
    requestedOperation,
    restrictions,
  });
  if (!result.allowed) {
    throw RestrictionErrors.operationBlocked({
      message: result.primaryRestriction?.safeText || 'Operation blocked.',
      details: {
        primaryReason: result.primaryRestriction?.reasonCode,
        secondary: result.secondaryRestrictions,
        requestedOperation,
      },
    });
  }
  return result;
}

export { RESTRICTION_SOURCE, RESTRICTION_SCOPE, RESTRICTION_STATE };
