/**
 * Shared conversion domain handoff helpers — Phase 16 Wave 4 / Phase 20 Wave 3.
 * Handoff ≠ execute. Idempotent by idempotencyKey.
 * One active onboarding handoff; secrets stripped; checksum on canonical package.
 */

import { createHash } from 'crypto';
import { resolveCrmAccess } from '../authz.js';
import { resolveConversionActor } from './model.js';

export const CRM_CONVERSION_HANDOFF_TYPE = Object.freeze({
  ONBOARDING: 'ONBOARDING',
  TRAINING: 'TRAINING',
  MIGRATION: 'MIGRATION',
  MRA_EIS: 'MRA_EIS',
  INTEGRATION: 'INTEGRATION',
});

export const CRM_CONVERSION_HANDOFF_STATUS = Object.freeze({
  EMITTED: 'EMITTED',
  READY: 'READY',
  SENT: 'SENT',
  ACCEPTED_BY_ONBOARDING: 'ACCEPTED_BY_ONBOARDING',
  SUPERSEDED: 'SUPERSEDED',
  CANCELLED: 'CANCELLED',
});

/** Phase 20 — onboarding package lifecycle (maps onto handoff.status). */
export const CRM_ONBOARDING_HANDOFF_PACKAGE_STATUS = Object.freeze({
  READY: 'READY',
  SENT: 'SENT',
  ACCEPTED_BY_ONBOARDING: 'ACCEPTED_BY_ONBOARDING',
  SUPERSEDED: 'SUPERSEDED',
  CANCELLED: 'CANCELLED',
});

export const CRM_CONVERSION_HANDOFF_EXECUTION = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
});

const ACTIVE_HANDOFF_STATUSES = Object.freeze([
  CRM_CONVERSION_HANDOFF_STATUS.EMITTED,
  CRM_CONVERSION_HANDOFF_STATUS.READY,
  CRM_CONVERSION_HANDOFF_STATUS.SENT,
  CRM_CONVERSION_HANDOFF_STATUS.ACCEPTED_BY_ONBOARDING,
]);

const FORBIDDEN_HANDOFF_PAYLOAD_KEYS = Object.freeze([
  'credentials',
  'mraCredentials',
  'password',
  'secret',
  'apiKey',
  'api_key',
  'token',
  'accessToken',
  'refreshToken',
  'clientSecret',
  'secretKey',
  'authToken',
  'bearerToken',
  'sessionToken',
  'rawToken',
  'rawPayload',
  'rawMraPayload',
  'mraPayload',
  'paymentSecret',
  'cardNumber',
  'cvv',
  'privateKey',
  'glLines',
  'tenantGl',
]);

/** Honesty boolean flags that contain forbidden substrings but must be retained. */
const HONESTY_FLAG_KEYS = Object.freeze([
  'credentialsstored',
  'fiscalsubmitted',
  'mraeisfiscalsubmitted',
  'onboardingcompleted',
  'trainingcompleted',
  'fabricatedcomplete',
  'executioncomplete',
  'productionimportexecuted',
]);

function isForbiddenPayloadKey(key) {
  const k = String(key || '');
  const lower = k.toLowerCase();
  if (HONESTY_FLAG_KEYS.includes(lower)) return false;
  // Exact secret containers
  if (FORBIDDEN_HANDOFF_PAYLOAD_KEYS.some((f) => lower === String(f).toLowerCase())) {
    return true;
  }
  // Substring denylist: password / apiKey / token / secret aliases (G20-15)
  if (
    lower.includes('password') ||
    lower.includes('apikey') ||
    lower.includes('api_key') ||
    lower.includes('privatekey') ||
    lower.includes('private_key') ||
    lower.includes('clientsecret') ||
    lower.includes('secretkey') ||
    lower.includes('paymentsecret') ||
    lower.includes('accesstoken') ||
    lower.includes('refreshtoken') ||
    lower.includes('authtoken') ||
    lower.includes('bearertoken') ||
    lower.includes('sessiontoken') ||
    lower.includes('secret') ||
    lower.includes('token') ||
    lower === 'rawpayload' ||
    lower === 'mrapayload' ||
    lower === 'rawmrapayload' ||
    lower === 'cardnumber' ||
    lower === 'cvv' ||
    lower === 'gllines' ||
    lower === 'tenantgl'
  ) {
    return true;
  }
  return false;
}

/**
 * Strip secrets / credentials from handoff payloads. Keeps scalar commercial refs.
 */
export function sanitizeConversionHandoffPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }
  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    if (isForbiddenPayloadKey(key)) continue;
    if (value == null) continue;
    if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? sanitizeConversionHandoffPayload(item)
          : item
      );
      continue;
    }
    if (typeof value === 'object') {
      const nested = sanitizeConversionHandoffPayload(value);
      if (Object.keys(nested).length) out[key] = nested;
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Stable checksum over canonical onboarding handoff package fields.
 */
export function computeOnboardingHandoffChecksum(payload = {}) {
  const canonical = {
    conversionId: payload.conversionId || null,
    tenantId: payload.tenantId || null,
    customerId: payload.customerId || payload.platformCustomerId || null,
    subscriptionId: payload.subscriptionId || null,
    contacts: payload.contacts || null,
    commercialRefs: payload.commercialRefs || null,
    scopes: payload.scopes || payload.scope || null,
    ownership: payload.ownership || null,
    successCriteria: payload.successCriteria || null,
    pendingProvisioning:
      payload.pendingProvisioning === true ||
      String(payload.provisioningStatus || '').toUpperCase() === 'PENDING',
    provisioningStatus: payload.provisioningStatus || null,
  };
  return createHash('sha256')
    .update(JSON.stringify(canonical))
    .digest('hex');
}

export function hasCrmConversionDomainHandoffModel(prisma) {
  return typeof prisma?.crmConversionDomainHandoff?.create === 'function';
}

export function serializeDomainHandoff(row) {
  if (!row) return null;
  return {
    id: row.id,
    conversionId: row.conversionId || null,
    tenantId: row.tenantId || null,
    handoffType: row.handoffType,
    status: row.status || CRM_CONVERSION_HANDOFF_STATUS.EMITTED,
    executionStatus: row.executionStatus || CRM_CONVERSION_HANDOFF_EXECUTION.NOT_STARTED,
    idempotencyKey: row.idempotencyKey || null,
    payloadJson: row.payloadJson ?? null,
    checksumSha256: row.checksumSha256 || null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    recordOnly: true,
    executesDomainWork: false,
  };
}

function isActiveHandoffStatus(status) {
  return ACTIVE_HANDOFF_STATUSES.includes(String(status || '').toUpperCase());
}

async function findActiveHandoffs(prisma, { conversionId, handoffType }) {
  if (!conversionId || typeof prisma?.crmConversionDomainHandoff?.findMany !== 'function') {
    return [];
  }
  const rows = await prisma.crmConversionDomainHandoff.findMany({
    where: {
      conversionId: String(conversionId),
      handoffType,
      status: { in: [...ACTIVE_HANDOFF_STATUSES] },
    },
  });
  return Array.isArray(rows) ? rows.filter((r) => isActiveHandoffStatus(r.status)) : [];
}

async function supersedeActiveHandoffs(prisma, {
  conversionId,
  handoffType,
  exceptId = null,
  supersededById = null,
  reason = null,
  now,
  admin = null,
}) {
  const actives = await findActiveHandoffs(prisma, { conversionId, handoffType });
  const history = [];
  for (const row of actives) {
    if (exceptId && row.id === exceptId) continue;
    const prevPayload =
      row.payloadJson && typeof row.payloadJson === 'object' ? row.payloadJson : {};
    const nextPayload = {
      ...prevPayload,
      supersededAt: (now || new Date()).toISOString(),
      supersededByHandoffId: supersededById || null,
      supersessionReason: reason || 'correction',
    };
    if (typeof prisma.crmConversionDomainHandoff.update === 'function') {
      await prisma.crmConversionDomainHandoff.update({
        where: { id: row.id },
        data: {
          status: CRM_CONVERSION_HANDOFF_STATUS.SUPERSEDED,
          payloadJson: nextPayload,
          updatedAt: now || new Date(),
        },
      });
    }
    history.push({
      handoffId: row.id,
      idempotencyKey: row.idempotencyKey || null,
      checksumSha256: row.checksumSha256 || null,
      supersededAt: nextPayload.supersededAt,
      reason: reason || 'correction',
      actorAdminId: admin?.id || null,
    });
  }
  return history;
}

/**
 * Create or replay a typed domain handoff. Never marks execution COMPLETED.
 * Onboarding: one active; exact idempotency retry same; correction supersedes.
 */
export async function createDomainHandoff(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const access = resolveCrmAccess(admin);
  if (
    !access.canEditOpportunities &&
    !access.canViewOpportunities &&
    !access.isSuperAdmin
  ) {
    return { ok: false, forbidden: true, reason: 'crm_conversion_handoff_forbidden' };
  }

  if (!hasCrmConversionDomainHandoffModel(prisma)) {
    return {
      ok: false,
      error: 'crm_conversion_domain_handoff_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const handoffType = String(args.handoffType || '').trim().toUpperCase();
  if (!Object.values(CRM_CONVERSION_HANDOFF_TYPE).includes(handoffType)) {
    return { ok: false, error: 'handoff_type_required' };
  }

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';
  if (!idempotencyKey) {
    return { ok: false, error: 'idempotency_key_required' };
  }

  const existing = await prisma.crmConversionDomainHandoff.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    return {
      ok: true,
      alreadyExists: true,
      idempotentReplay: true,
      handoff: serializeDomainHandoff(existing),
      checksumSha256: existing.checksumSha256 || null,
      created: false,
    };
  }

  const now = args.now || new Date();
  const conversionId = args.conversionId ? String(args.conversionId) : null;
  const rawPayload =
    args.payload && typeof args.payload === 'object' ? args.payload : {};
  const sanitized = sanitizeConversionHandoffPayload(rawPayload);

  const pendingProvisioning =
    sanitized.pendingProvisioning === true ||
    String(sanitized.provisioningStatus || args.provisioningStatus || 'PENDING')
      .toUpperCase() === 'PENDING' ||
    args.pendingProvisioning !== false;

  const basePayload = {
    ...sanitized,
    handoffType,
    conversionId: conversionId || sanitized.conversionId || null,
    tenantId: args.tenantId || sanitized.tenantId || null,
    executesDomainWork: false,
    executionComplete: false,
    executionStatus: CRM_CONVERSION_HANDOFF_EXECUTION.NOT_STARTED,
    pendingProvisioning,
    provisioningStatus: pendingProvisioning
      ? 'PENDING'
      : sanitized.provisioningStatus || null,
    onboardingProjectCreated: false,
    createsOnboardingProject: false,
  };

  // Always compute server-side from sanitized payload; never trust caller checksum.
  // Validate before any supersession mutation so a forged checksum cannot mutate state.
  const checksumSha256 = computeOnboardingHandoffChecksum(basePayload);
  if (args.checksumSha256 != null && String(args.checksumSha256).trim()) {
    const supplied = String(args.checksumSha256).trim().toLowerCase();
    if (supplied !== String(checksumSha256).toLowerCase()) {
      return {
        ok: false,
        error: 'checksum_mismatch',
        expectedChecksumSha256: checksumSha256,
      };
    }
  }

  let supersessionHistory = Array.isArray(basePayload.supersessionHistory)
    ? [...basePayload.supersessionHistory]
    : [];
  let supersededHandoffId = null;

  if (handoffType === CRM_CONVERSION_HANDOFF_TYPE.ONBOARDING && conversionId) {
    const actives = await findActiveHandoffs(prisma, {
      conversionId,
      handoffType,
    });
    if (actives.length) {
      const correction = args.correction === true || args.supersedeActive === true;
      if (!correction) {
        return {
          ok: false,
          error: 'active_handoff_exists_use_correction',
          activeHandoffId: actives[0].id,
          activeChecksumSha256: actives[0].checksumSha256 || null,
        };
      }
      const history = await supersedeActiveHandoffs(prisma, {
        conversionId,
        handoffType,
        reason: args.correctionReason || sanitized.correctionReason || 'correction',
        now,
        admin,
      });
      supersessionHistory = [...history, ...supersessionHistory];
      supersededHandoffId = actives[0].id;
    }
  }

  const payloadJson = {
    ...basePayload,
    supersedesHandoffId: supersededHandoffId,
    supersessionHistory,
  };

  // Never accept caller-forced COMPLETED for onboarding/training execution.
  const executionStatus = CRM_CONVERSION_HANDOFF_EXECUTION.NOT_STARTED;
  const initialStatus =
    handoffType === CRM_CONVERSION_HANDOFF_TYPE.ONBOARDING
      ? CRM_ONBOARDING_HANDOFF_PACKAGE_STATUS.READY
      : CRM_CONVERSION_HANDOFF_STATUS.EMITTED;

  const row = await prisma.crmConversionDomainHandoff.create({
    data: {
      conversionId,
      tenantId: args.tenantId ? String(args.tenantId) : null,
      handoffType,
      status: initialStatus,
      executionStatus,
      idempotencyKey,
      payloadJson,
      checksumSha256,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  // Back-fill supersededBy on history rows once new id known
  if (supersededHandoffId && typeof prisma.crmConversionDomainHandoff.update === 'function') {
    try {
      const prior = await prisma.crmConversionDomainHandoff.findUnique({
        where: { id: supersededHandoffId },
      });
      if (prior) {
        const priorPayload =
          prior.payloadJson && typeof prior.payloadJson === 'object'
            ? prior.payloadJson
            : {};
        await prisma.crmConversionDomainHandoff.update({
          where: { id: prior.id },
          data: {
            payloadJson: {
              ...priorPayload,
              supersededByHandoffId: row.id,
            },
            updatedAt: now,
          },
        });
      }
    } catch {
      /* best-effort history link */
    }
  }

  return {
    ok: true,
    created: true,
    handoff: serializeDomainHandoff(row),
    checksumSha256,
    supersededHandoffId,
    supersessionHistory,
    createsOnboardingProject: false,
  };
}

/**
 * Mark onboarding handoff SENT (READY/EMITTED → SENT). Never creates Project.
 */
export async function sendDomainHandoff(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const access = resolveCrmAccess(admin);
  if (
    !access.canEditOpportunities &&
    !access.canViewOpportunities &&
    !access.isSuperAdmin
  ) {
    return { ok: false, forbidden: true, reason: 'crm_conversion_handoff_forbidden' };
  }
  if (!hasCrmConversionDomainHandoffModel(prisma)) {
    return { ok: false, error: 'crm_conversion_domain_handoff_model_unavailable' };
  }
  const handoffId = args.handoffId ? String(args.handoffId).trim() : '';
  if (!handoffId) return { ok: false, error: 'handoff_id_required' };

  const row = await prisma.crmConversionDomainHandoff.findUnique({
    where: { id: handoffId },
  });
  if (!row) return { ok: false, notFound: true, error: 'handoff_not_found' };
  if (row.status === CRM_CONVERSION_HANDOFF_STATUS.SUPERSEDED) {
    return { ok: false, error: 'handoff_superseded' };
  }
  if (row.status === CRM_ONBOARDING_HANDOFF_PACKAGE_STATUS.SENT) {
    return {
      ok: true,
      alreadySent: true,
      handoff: serializeDomainHandoff(row),
      createsOnboardingProject: false,
    };
  }

  const now = args.now || new Date();
  const payload =
    row.payloadJson && typeof row.payloadJson === 'object' ? { ...row.payloadJson } : {};
  payload.sentAt = now.toISOString();
  payload.onboardingProjectCreated = false;

  const updated = await prisma.crmConversionDomainHandoff.update({
    where: { id: row.id },
    data: {
      status: CRM_ONBOARDING_HANDOFF_PACKAGE_STATUS.SENT,
      payloadJson: payload,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    handoff: serializeDomainHandoff(updated),
    createsOnboardingProject: false,
  };
}

/**
 * Explicitly supersede a handoff (history retained on payload).
 */
export async function supersedeDomainHandoff(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const access = resolveCrmAccess(admin);
  if (
    !access.canEditOpportunities &&
    !access.isSuperAdmin
  ) {
    return { ok: false, forbidden: true, reason: 'crm_conversion_handoff_forbidden' };
  }
  if (!hasCrmConversionDomainHandoffModel(prisma)) {
    return { ok: false, error: 'crm_conversion_domain_handoff_model_unavailable' };
  }
  const handoffId = args.handoffId ? String(args.handoffId).trim() : '';
  if (!handoffId) return { ok: false, error: 'handoff_id_required' };

  const row = await prisma.crmConversionDomainHandoff.findUnique({
    where: { id: handoffId },
  });
  if (!row) return { ok: false, notFound: true, error: 'handoff_not_found' };
  if (row.status === CRM_CONVERSION_HANDOFF_STATUS.SUPERSEDED) {
    return {
      ok: true,
      alreadySuperseded: true,
      handoff: serializeDomainHandoff(row),
    };
  }

  const now = args.now || new Date();
  const payload =
    row.payloadJson && typeof row.payloadJson === 'object' ? { ...row.payloadJson } : {};
  payload.supersededAt = now.toISOString();
  payload.supersessionReason = args.reason || 'manual_supersede';

  const updated = await prisma.crmConversionDomainHandoff.update({
    where: { id: row.id },
    data: {
      status: CRM_CONVERSION_HANDOFF_STATUS.SUPERSEDED,
      payloadJson: payload,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    handoff: serializeDomainHandoff(updated),
    supersessionHistory: [
      {
        handoffId: updated.id,
        supersededAt: payload.supersededAt,
        reason: payload.supersessionReason,
        actorAdminId: admin?.id || null,
      },
    ],
  };
}
