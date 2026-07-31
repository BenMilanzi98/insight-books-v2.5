/**
 * Consume / validate / accept Phase 16–20 ONBOARDING domain handoff → Request.
 * Phase 21 Wave 1: checksum validate; UNKNOWN ≠ VALID; accept idempotent.
 * Never fabricates onboarding complete. Never marks handoff execution COMPLETED.
 * Accept does not create Onboarding Project.
 */

import { createHash } from 'crypto';
import {
  CRM_CONVERSION_HANDOFF_TYPE,
  CRM_CONVERSION_HANDOFF_EXECUTION,
  CRM_CONVERSION_HANDOFF_STATUS,
  hasCrmConversionDomainHandoffModel,
  serializeDomainHandoff,
  computeOnboardingHandoffChecksum,
} from '../../crm/conversions/handoffShared.js';
import {
  ONBOARDING_REQUEST_SOURCE,
  ONBOARDING_TYPE,
  ONBOARDING_HANDOFF_VALIDATION_STATUS,
  ONBOARDING_PROJECT_STATUS,
  getOnboardingDomainContract,
} from './catalogue.js';
import {
  canManageOnboarding,
  hasCustomerOnboardingRequestModel,
  hasCustomerOnboardingProjectModel,
  resolveOnboardingActor,
  serializeOnboardingRequest,
} from './model.js';
import { createOnboardingRequest } from './requests.js';
import { assertOnboardingTenantInPortfolioScope } from './projectAccess.js';

const ACTIVE_PROJECT_EXCLUSIONS = Object.freeze([
  ONBOARDING_PROJECT_STATUS.CANCELLED,
  ONBOARDING_PROJECT_STATUS.ARCHIVED,
  ONBOARDING_PROJECT_STATUS.COMPLETED,
  ONBOARDING_PROJECT_STATUS.COMPLETED_WITH_OPEN_ITEMS,
  ONBOARDING_PROJECT_STATUS.COMPLETED_WITH_GAPS,
  ONBOARDING_PROJECT_STATUS.FAILED,
]);

function hashAcceptInput(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function payloadOf(handoff) {
  return handoff?.payloadJson && typeof handoff.payloadJson === 'object'
    ? handoff.payloadJson
    : {};
}

/**
 * Pure checksum evaluation — missing checksum → UNKNOWN (never VALID).
 */
export function evaluateOnboardingHandoffChecksum(handoff) {
  const stored =
    handoff?.checksumSha256 != null ? String(handoff.checksumSha256).trim() : '';
  const payload = payloadOf(handoff);
  const expected = computeOnboardingHandoffChecksum(payload);

  if (!stored) {
    return {
      checksumValid: false,
      validationStatus: ONBOARDING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
      expectedChecksumSha256: expected || null,
      storedChecksumSha256: null,
    };
  }

  if (stored.toLowerCase() !== String(expected).toLowerCase()) {
    return {
      checksumValid: false,
      validationStatus: ONBOARDING_HANDOFF_VALIDATION_STATUS.INVALID,
      expectedChecksumSha256: expected,
      storedChecksumSha256: stored,
    };
  }

  return {
    checksumValid: true,
    validationStatus: ONBOARDING_HANDOFF_VALIDATION_STATUS.VALID,
    expectedChecksumSha256: expected,
    storedChecksumSha256: stored,
  };
}

function isAcceptableValidationStatus(status) {
  return (
    status === ONBOARDING_HANDOFF_VALIDATION_STATUS.VALID ||
    status === ONBOARDING_HANDOFF_VALIDATION_STATUS.VALID_WITH_WARNINGS
  );
}

/**
 * Validate onboarding handoff package (identity pins + checksum).
 * UNKNOWN / INVALID never report as VALID.
 */
export async function validateOnboardingHandoff(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canManageOnboarding(admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'onboarding_handoff_validate_forbidden',
      validationStatus: ONBOARDING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
      checksumValid: false,
    };
  }
  if (!hasCrmConversionDomainHandoffModel(prisma)) {
    return {
      ok: false,
      error: 'crm_conversion_domain_handoff_model_unavailable',
      status: 'UNAVAILABLE',
      validationStatus: ONBOARDING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
      checksumValid: false,
    };
  }

  const handoffId = args.handoffId ? String(args.handoffId).trim() : '';
  if (!handoffId) {
    return {
      ok: false,
      error: 'handoff_id_required',
      validationStatus: ONBOARDING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
      checksumValid: false,
    };
  }

  const handoff = await prisma.crmConversionDomainHandoff.findUnique({
    where: { id: handoffId },
  });
  if (!handoff) {
    return {
      ok: false,
      notFound: true,
      error: 'handoff_not_found',
      validationStatus: ONBOARDING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
      checksumValid: false,
    };
  }
  if (handoff.handoffType !== CRM_CONVERSION_HANDOFF_TYPE.ONBOARDING) {
    return {
      ok: false,
      error: 'handoff_type_not_onboarding',
      handoffType: handoff.handoffType,
      validationStatus: ONBOARDING_HANDOFF_VALIDATION_STATUS.INVALID,
      checksumValid: false,
    };
  }

  const checksum = evaluateOnboardingHandoffChecksum(handoff);
  if (!checksum.checksumValid) {
    return {
      ok: false,
      error:
        checksum.validationStatus === ONBOARDING_HANDOFF_VALIDATION_STATUS.UNKNOWN
          ? 'handoff_checksum_unknown'
          : 'handoff_checksum_mismatch',
      handoff: serializeDomainHandoff(handoff),
      ...checksum,
      domain: getOnboardingDomainContract(),
    };
  }

  const payload = payloadOf(handoff);
  const customerId = payload.customerId || payload.platformCustomerId || null;
  const tenantId = handoff.tenantId || payload.tenantId || null;
  const subscriptionId =
    payload.subscriptionId || payload.accountSubscriptionId || null;
  const missing = [];
  if (!customerId) missing.push('customerId');
  if (!tenantId) missing.push('tenantId');
  if (!subscriptionId) missing.push('subscriptionId');

  if (missing.length) {
    return {
      ok: false,
      error: `missing_required_pins: ${missing.join(',')}`,
      missing,
      handoff: serializeDomainHandoff(handoff),
      checksumValid: true,
      validationStatus: ONBOARDING_HANDOFF_VALIDATION_STATUS.CORRECTION_REQUIRED,
      expectedChecksumSha256: checksum.expectedChecksumSha256,
      storedChecksumSha256: checksum.storedChecksumSha256,
      domain: getOnboardingDomainContract(),
    };
  }

  let validationStatus = ONBOARDING_HANDOFF_VALIDATION_STATUS.VALID;
  const warnings = [];
  if (
    payload.pendingProvisioning === true ||
    String(payload.provisioningStatus || '').toUpperCase() === 'PENDING'
  ) {
    validationStatus = ONBOARDING_HANDOFF_VALIDATION_STATUS.VALID_WITH_WARNINGS;
    warnings.push('pending_provisioning');
  }

  return {
    ok: true,
    handoff: serializeDomainHandoff(handoff),
    checksumValid: true,
    validationStatus,
    warnings,
    expectedChecksumSha256: checksum.expectedChecksumSha256,
    storedChecksumSha256: checksum.storedChecksumSha256,
    // Honesty: validation ≠ provision/activation/Training/go-live
    onboardingCompleted: false,
    provisioned: false,
    domain: getOnboardingDomainContract(),
  };
}

async function findActiveProjectForHandoff(prisma, { handoffId, customerId, tenantId }) {
  if (!hasCustomerOnboardingProjectModel(prisma)) return null;
  if (typeof prisma.customerOnboardingProject.findFirst !== 'function') return null;

  if (handoffId) {
    const byHandoff = await prisma.customerOnboardingProject.findFirst({
      where: {
        handoffId: String(handoffId),
        status: { notIn: [...ACTIVE_PROJECT_EXCLUSIONS] },
      },
    });
    if (byHandoff) return byHandoff;
  }

  if (customerId && tenantId) {
    return prisma.customerOnboardingProject.findFirst({
      where: {
        customerId: String(customerId),
        tenantId: String(tenantId),
        status: { notIn: [...ACTIVE_PROJECT_EXCLUSIONS] },
      },
    });
  }
  return null;
}

/**
 * Typed handoff execution update — only NOT_STARTED → IN_PROGRESS.
 * Never COMPLETED / fabricated onboarding complete.
 */
export async function acknowledgeOnboardingHandoffInProgress(prisma, args = {}) {
  const handoffId = args.handoffId ? String(args.handoffId).trim() : '';
  if (!handoffId || !hasCrmConversionDomainHandoffModel(prisma)) {
    return { ok: false, error: 'handoff_unavailable' };
  }

  const handoff = await prisma.crmConversionDomainHandoff.findUnique({
    where: { id: handoffId },
  });
  if (!handoff) {
    return { ok: false, notFound: true, error: 'handoff_not_found' };
  }
  if (handoff.handoffType !== CRM_CONVERSION_HANDOFF_TYPE.ONBOARDING) {
    return { ok: false, error: 'handoff_type_not_onboarding' };
  }

  const current = String(handoff.executionStatus || '').toUpperCase();
  if (current === CRM_CONVERSION_HANDOFF_EXECUTION.COMPLETED) {
    return {
      ok: false,
      error: 'handoff_execution_completed_forbidden_from_onboarding',
    };
  }
  if (current === CRM_CONVERSION_HANDOFF_EXECUTION.IN_PROGRESS) {
    return {
      ok: true,
      alreadyInProgress: true,
      handoff: serializeDomainHandoff(handoff),
    };
  }

  const now = args.now || new Date();
  const updated = await prisma.crmConversionDomainHandoff.update({
    where: { id: handoff.id },
    data: {
      executionStatus: CRM_CONVERSION_HANDOFF_EXECUTION.IN_PROGRESS,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    handoff: serializeDomainHandoff(updated),
    onboardingCompleted: false,
  };
}

/**
 * Auto-create ONR Request from Phase 16 ONBOARDING handoff (idempotent).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ actorContext?: object, admin?: object, handoffId: string, idempotencyKey: string, allowIncompletePins?: boolean, now?: Date }} args
 */
export async function consumeOnboardingHandoff(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canManageOnboarding(admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'onboarding_handoff_consume_forbidden',
    };
  }
  if (!hasCustomerOnboardingRequestModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_request_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }
  if (!hasCrmConversionDomainHandoffModel(prisma)) {
    return {
      ok: false,
      error: 'crm_conversion_domain_handoff_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const handoffId = args.handoffId ? String(args.handoffId).trim() : '';
  if (!handoffId) {
    return { ok: false, error: 'handoff_id_required' };
  }

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : `onr-from-handoff:${handoffId}`;
  if (!idempotencyKey) {
    return { ok: false, error: 'idempotency_key_required' };
  }

  const handoff = await prisma.crmConversionDomainHandoff.findUnique({
    where: { id: handoffId },
  });
  if (!handoff) {
    return { ok: false, notFound: true, error: 'handoff_not_found' };
  }
  if (handoff.handoffType !== CRM_CONVERSION_HANDOFF_TYPE.ONBOARDING) {
    return {
      ok: false,
      error: 'handoff_type_not_onboarding',
      handoffType: handoff.handoffType,
    };
  }

  const payload = payloadOf(handoff);

  // Never trust caller/payload fabricated completion flags.
  if (payload.onboardingCompleted === true || payload.fabricatedComplete === true) {
    // Still consume as record — but force false in stored payload.
  }

  const customerId =
    args.customerId || payload.customerId || payload.platformCustomerId || null;
  const tenantId = args.tenantId || handoff.tenantId || payload.tenantId || null;
  const subscriptionId =
    args.subscriptionId ||
    payload.subscriptionId ||
    payload.accountSubscriptionId ||
    null;
  const conversionId =
    args.conversionId || handoff.conversionId || payload.conversionId || null;

  const created = await createOnboardingRequest(prisma, {
    ...args,
    admin,
    actorContext: args.actorContext || { admin },
    source: ONBOARDING_REQUEST_SOURCE.PHASE_16_ONBOARDING_HANDOFF,
    onboardingType: args.onboardingType || ONBOARDING_TYPE.STANDARD,
    handoffId: handoff.id,
    conversionId,
    customerId,
    tenantId,
    subscriptionId,
    payloadJson: {
      ...payload,
      onboardingCompleted: false,
      fabricatedComplete: false,
      executionComplete: false,
      handoffType: CRM_CONVERSION_HANDOFF_TYPE.ONBOARDING,
    },
    idempotencyKey,
  });

  if (!created.ok) return created;

  // Typed acknowledge only — never COMPLETED.
  // Also repair on idempotent replay: if Request already exists but first ack
  // failed, handoff must not stay stuck at NOT_STARTED.
  const ack = await acknowledgeOnboardingHandoffInProgress(prisma, {
    handoffId: handoff.id,
    now: args.now,
  });

  return {
    ...created,
    handoffId: handoff.id,
    handoffExecutionStatus:
      ack?.handoff?.executionStatus ||
      CRM_CONVERSION_HANDOFF_EXECUTION.IN_PROGRESS,
    onboardingCompleted: false,
    fabricatedComplete: false,
    domain: getOnboardingDomainContract(),
  };
}

/**
 * Accept a validated Phase 20 onboarding handoff (design §6).
 * Authorise → portfolio fail-closed → checksum VALID → no duplicate active Project →
 * create Request via consume → mark ACCEPTED_BY_ONBOARDING. Exact retry same.
 * Does not create Project; does not prove provision/activation/Training/go-live.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   actorContext?: object,
 *   admin?: object,
 *   handoffId: string,
 *   expectedVersion?: string|number,
 *   acceptanceNotes?: string,
 *   idempotencyKey: string,
 *   portfolioTenantIds?: string[],
 *   now?: Date,
 * }} args
 */
export async function acceptOnboardingHandoff(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canManageOnboarding(admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'onboarding_handoff_accept_forbidden',
      validationStatus: ONBOARDING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
      checksumValid: false,
    };
  }
  if (!hasCrmConversionDomainHandoffModel(prisma)) {
    return {
      ok: false,
      error: 'crm_conversion_domain_handoff_model_unavailable',
      status: 'UNAVAILABLE',
      validationStatus: ONBOARDING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
      checksumValid: false,
    };
  }
  if (!hasCustomerOnboardingRequestModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_request_model_unavailable',
      status: 'UNAVAILABLE',
      validationStatus: ONBOARDING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
      checksumValid: false,
    };
  }

  const handoffId = args.handoffId ? String(args.handoffId).trim() : '';
  if (!handoffId) {
    return {
      ok: false,
      error: 'handoff_id_required',
      validationStatus: ONBOARDING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
      checksumValid: false,
    };
  }

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';
  if (!idempotencyKey) {
    return {
      ok: false,
      error: 'idempotency_key_required',
      validationStatus: ONBOARDING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
      checksumValid: false,
    };
  }

  const handoff = await prisma.crmConversionDomainHandoff.findUnique({
    where: { id: handoffId },
  });
  if (!handoff) {
    return {
      ok: false,
      notFound: true,
      error: 'handoff_not_found',
      validationStatus: ONBOARDING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
      checksumValid: false,
    };
  }
  if (handoff.handoffType !== CRM_CONVERSION_HANDOFF_TYPE.ONBOARDING) {
    return {
      ok: false,
      error: 'handoff_type_not_onboarding',
      validationStatus: ONBOARDING_HANDOFF_VALIDATION_STATUS.INVALID,
      checksumValid: false,
    };
  }

  const statusUpper = String(handoff.status || '').toUpperCase();
  if (statusUpper === CRM_CONVERSION_HANDOFF_STATUS.SUPERSEDED) {
    return {
      ok: false,
      error: 'handoff_superseded',
      handoff: serializeDomainHandoff(handoff),
      validationStatus: ONBOARDING_HANDOFF_VALIDATION_STATUS.CORRECTION_REQUIRED,
      checksumValid: false,
    };
  }
  if (statusUpper === CRM_CONVERSION_HANDOFF_STATUS.CANCELLED) {
    return {
      ok: false,
      error: 'handoff_cancelled',
      handoff: serializeDomainHandoff(handoff),
      validationStatus: ONBOARDING_HANDOFF_VALIDATION_STATUS.INVALID,
      checksumValid: false,
    };
  }

  const payload = payloadOf(handoff);
  const tenantId = handoff.tenantId || payload.tenantId || null;

  const scopeGate = await assertOnboardingTenantInPortfolioScope(
    prisma,
    admin,
    tenantId,
    args
  );
  if (!scopeGate.ok) return scopeGate;

  if (args.expectedVersion != null && String(args.expectedVersion).trim()) {
    const actualVersion =
      payload.version != null
        ? String(payload.version)
        : payload.packageVersion != null
          ? String(payload.packageVersion)
          : handoff.checksumSha256
            ? String(handoff.checksumSha256)
            : null;
    if (
      actualVersion != null &&
      String(args.expectedVersion).trim() !== String(actualVersion).trim()
    ) {
      return {
        ok: false,
        error: 'handoff_expected_version_mismatch',
        expectedVersion: String(args.expectedVersion).trim(),
        actualVersion,
        validationStatus: ONBOARDING_HANDOFF_VALIDATION_STATUS.CORRECTION_REQUIRED,
        checksumValid: false,
      };
    }
  }

  const validated = await validateOnboardingHandoff(prisma, {
    ...args,
    admin,
    handoffId,
  });
  if (!validated.ok || !isAcceptableValidationStatus(validated.validationStatus)) {
    return {
      ...validated,
      ok: false,
      error: validated.error || 'handoff_validation_failed',
      // Enforce UNKNOWN ≠ VALID explicitly
      validationStatus:
        validated.validationStatus || ONBOARDING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
      checksumValid: validated.checksumValid === true,
    };
  }
  if (
    validated.validationStatus === ONBOARDING_HANDOFF_VALIDATION_STATUS.UNKNOWN
  ) {
    return {
      ok: false,
      error: 'handoff_checksum_unknown',
      validationStatus: ONBOARDING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
      checksumValid: false,
    };
  }

  const customerId = payload.customerId || payload.platformCustomerId || null;
  const activeProject = await findActiveProjectForHandoff(prisma, {
    handoffId,
    customerId,
    tenantId,
  });
  if (activeProject) {
    return {
      ok: false,
      error: 'active_project_exists',
      existingProjectId: activeProject.id,
      validationStatus: validated.validationStatus,
      checksumValid: true,
    };
  }

  const acceptInput = {
    handoffId,
    acceptanceNotes:
      args.acceptanceNotes != null ? String(args.acceptanceNotes) : null,
    expectedVersion:
      args.expectedVersion != null ? String(args.expectedVersion) : null,
  };
  const acceptInputHash = hashAcceptInput(acceptInput);
  const now = args.now || new Date();

  // Exact / conflicting retry by accept idempotency key (Request row)
  if (typeof prisma.customerOnboardingRequest.findUnique === 'function') {
    try {
      const existingByKey = await prisma.customerOnboardingRequest.findUnique({
        where: { idempotencyKey },
      });
      if (existingByKey) {
        const sameHandoff = String(existingByKey.handoffId || '') === handoffId;
        if (!sameHandoff) {
          return {
            ok: false,
            error: 'idempotency_conflict',
            existingHandoffId: existingByKey.handoffId || null,
            attemptedHandoffId: handoffId,
          };
        }
        // Repair ACCEPTED_BY_ONBOARDING on replay
        if (statusUpper !== CRM_CONVERSION_HANDOFF_STATUS.ACCEPTED_BY_ONBOARDING) {
          await markHandoffAcceptedByOnboarding(prisma, {
            handoff,
            admin,
            acceptanceNotes: args.acceptanceNotes,
            idempotencyKey,
            acceptInputHash,
            requestId: existingByKey.id,
            now,
          });
        }
        return {
          ok: true,
          request: serializeOnboardingRequest(existingByKey),
          handoff: serializeDomainHandoff(
            (await prisma.crmConversionDomainHandoff.findUnique({
              where: { id: handoffId },
            })) || handoff
          ),
          alreadyExists: true,
          idempotentReplay: true,
          alreadyAccepted: true,
          checksumValid: true,
          validationStatus: validated.validationStatus,
          onboardingCompleted: false,
          projectCreated: false,
          domain: getOnboardingDomainContract(),
        };
      }
    } catch {
      // continue
    }
  }

  // Already accepted this handoff (different key) → return existing Request
  if (statusUpper === CRM_CONVERSION_HANDOFF_STATUS.ACCEPTED_BY_ONBOARDING) {
    const existingReq = await prisma.customerOnboardingRequest.findFirst({
      where: {
        handoffId,
        source: ONBOARDING_REQUEST_SOURCE.PHASE_16_ONBOARDING_HANDOFF,
      },
    });
    if (existingReq) {
      return {
        ok: true,
        request: serializeOnboardingRequest(existingReq),
        handoff: serializeDomainHandoff(handoff),
        alreadyAccepted: true,
        idempotentReplay: true,
        checksumValid: true,
        validationStatus: validated.validationStatus,
        onboardingCompleted: false,
        projectCreated: false,
        domain: getOnboardingDomainContract(),
      };
    }
  }

  const consumed = await consumeOnboardingHandoff(prisma, {
    ...args,
    admin,
    actorContext: args.actorContext || { admin },
    handoffId,
    idempotencyKey,
  });
  if (!consumed.ok) {
    if (consumed.error === 'idempotency_conflict') {
      return consumed;
    }
    return consumed;
  }

  // Stamp acceptance on request payload (preserves supersession history on handoff)
  if (consumed.request?.id) {
    try {
      const row = await prisma.customerOnboardingRequest.findUnique({
        where: { id: consumed.request.id },
      });
      if (row) {
        const prev =
          row.payloadJson && typeof row.payloadJson === 'object' ? row.payloadJson : {};
        await prisma.customerOnboardingRequest.update({
          where: { id: row.id },
          data: {
            payloadJson: {
              ...prev,
              handoffAcceptance: {
                inputHash: acceptInputHash,
                idempotencyKey,
                acceptanceNotes:
                  args.acceptanceNotes != null
                    ? String(args.acceptanceNotes).slice(0, 2000)
                    : null,
                acceptedAt: now.toISOString(),
                acceptedByAdminId: admin?.id || null,
              },
            },
            updatedAt: now,
          },
        });
      }
    } catch {
      // non-fatal — accept still succeeds
    }
  }

  const marked = await markHandoffAcceptedByOnboarding(prisma, {
    handoff,
    admin,
    acceptanceNotes: args.acceptanceNotes,
    idempotencyKey,
    acceptInputHash,
    requestId: consumed.request?.id || null,
    now,
  });

  const freshRequest = consumed.request?.id
    ? await prisma.customerOnboardingRequest.findUnique({
        where: { id: consumed.request.id },
      })
    : null;

  return {
    ok: true,
    request: serializeOnboardingRequest(freshRequest || consumed.request),
    handoff: marked.handoff || serializeDomainHandoff(handoff),
    alreadyExists: consumed.alreadyExists || false,
    idempotentReplay: consumed.idempotentReplay || false,
    checksumValid: true,
    validationStatus: validated.validationStatus,
    onboardingCompleted: false,
    fabricatedComplete: false,
    projectCreated: false,
    domain: getOnboardingDomainContract(),
  };
}

async function markHandoffAcceptedByOnboarding(prisma, args = {}) {
  const { handoff, admin, acceptanceNotes, idempotencyKey, acceptInputHash, requestId, now } =
    args;
  const prev = payloadOf(handoff);
  // Preserve supersession / correction history; never overwrite prior records.
  const nextPayload = {
    ...prev,
    supersessionHistory: Array.isArray(prev.supersessionHistory)
      ? prev.supersessionHistory
      : prev.supersessionHistory || undefined,
    onboardingAcceptance: {
      ...(prev.onboardingAcceptance && typeof prev.onboardingAcceptance === 'object'
        ? prev.onboardingAcceptance
        : {}),
      acceptedAt: (now || new Date()).toISOString(),
      acceptedByAdminId: admin?.id || null,
      acceptanceNotes:
        acceptanceNotes != null ? String(acceptanceNotes).slice(0, 2000) : null,
      idempotencyKey: idempotencyKey || null,
      inputHash: acceptInputHash || null,
      requestId: requestId || null,
    },
    onboardingCompleted: false,
    fabricatedComplete: false,
    createsOnboardingProject: false,
  };

  const updated = await prisma.crmConversionDomainHandoff.update({
    where: { id: handoff.id },
    data: {
      status: CRM_CONVERSION_HANDOFF_STATUS.ACCEPTED_BY_ONBOARDING,
      payloadJson: nextPayload,
      updatedAt: now || new Date(),
    },
  });

  return { ok: true, handoff: serializeDomainHandoff(updated) };
}

export { ONBOARDING_HANDOFF_VALIDATION_STATUS };
