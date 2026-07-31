/**
 * Consume / validate / accept Training handoffs.
 * - Legacy CRM Phase 16 TRAINING domain handoff → TRQ (consumeTrainingHandoff)
 * - Phase 21 Phase22 Training handoff → checksum validate / accept → TRQ
 * Never fabricates trainingCompleted. Never creates Sessions / attendance / certs.
 */

import { createHash } from 'crypto';
import {
  CRM_CONVERSION_HANDOFF_TYPE,
  CRM_CONVERSION_HANDOFF_EXECUTION,
  hasCrmConversionDomainHandoffModel,
  serializeDomainHandoff,
} from '../../crm/conversions/handoffShared.js';
import { PHASE22_TRAINING_HANDOFF_STATUS } from '../onboarding/catalogue.js';
import { computePhase22TrainingHandoffChecksum } from '../onboarding/training.js';
import {
  hasCustomerOnboardingPhase22TrainingHandoffModel,
  serializePhase22TrainingHandoff,
} from '../onboarding/model.js';
import {
  TRAINING_REQUEST_SOURCE,
  TRAINING_TYPE,
  TRAINING_HANDOFF_VALIDATION_STATUS,
  getTrainingDomainContract,
} from './catalogue.js';
import {
  canManageTraining,
  hasCustomerTrainingRequestModel,
  resolveTrainingActor,
  serializeTrainingRequest,
} from './model.js';
import { createTrainingRequest } from './requests.js';
import { assertTrainingTenantInPortfolioScope } from './programAccess.js';
import { findActiveProgramForPurpose } from './programs.js';

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
export function evaluatePhase22TrainingHandoffChecksum(handoff) {
  const stored =
    handoff?.checksumSha256 != null ? String(handoff.checksumSha256).trim() : '';
  const payload = payloadOf(handoff);
  const expected = computePhase22TrainingHandoffChecksum(payload);

  if (!stored) {
    return {
      checksumValid: false,
      validationStatus: TRAINING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
      expectedChecksumSha256: expected || null,
      storedChecksumSha256: null,
    };
  }

  if (stored.toLowerCase() !== String(expected).toLowerCase()) {
    return {
      checksumValid: false,
      validationStatus: TRAINING_HANDOFF_VALIDATION_STATUS.INVALID,
      expectedChecksumSha256: expected,
      storedChecksumSha256: stored,
    };
  }

  return {
    checksumValid: true,
    validationStatus: TRAINING_HANDOFF_VALIDATION_STATUS.VALID,
    expectedChecksumSha256: expected,
    storedChecksumSha256: stored,
  };
}

function isAcceptableValidationStatus(status) {
  return (
    status === TRAINING_HANDOFF_VALIDATION_STATUS.VALID ||
    status === TRAINING_HANDOFF_VALIDATION_STATUS.VALID_WITH_WARNINGS
  );
}

/**
 * Validate Phase 21 → Phase 22 Training handoff package (pins + checksum).
 * UNKNOWN / INVALID never report as VALID.
 */
export async function validateTrainingHandoff(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'training_handoff_validate_forbidden',
      validationStatus: TRAINING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
      checksumValid: false,
    };
  }
  if (!hasCustomerOnboardingPhase22TrainingHandoffModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_phase22_training_handoff_model_unavailable',
      status: 'UNAVAILABLE',
      validationStatus: TRAINING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
      checksumValid: false,
    };
  }

  const handoffId = args.handoffId ? String(args.handoffId).trim() : '';
  if (!handoffId) {
    return {
      ok: false,
      error: 'handoff_id_required',
      validationStatus: TRAINING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
      checksumValid: false,
    };
  }

  const handoff = await prisma.customerOnboardingPhase22TrainingHandoff.findUnique({
    where: { id: handoffId },
  });
  if (!handoff) {
    return {
      ok: false,
      notFound: true,
      error: 'handoff_not_found',
      validationStatus: TRAINING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
      checksumValid: false,
    };
  }

  const statusUpper = String(handoff.status || '').toUpperCase();
  if (statusUpper === PHASE22_TRAINING_HANDOFF_STATUS.SUPERSEDED) {
    return {
      ok: false,
      error: 'handoff_superseded',
      handoff: serializePhase22TrainingHandoff(handoff),
      validationStatus: TRAINING_HANDOFF_VALIDATION_STATUS.SUPERSEDED,
      checksumValid: false,
      domain: getTrainingDomainContract(),
    };
  }

  const checksum = evaluatePhase22TrainingHandoffChecksum(handoff);
  if (!checksum.checksumValid) {
    return {
      ok: false,
      error:
        checksum.validationStatus === TRAINING_HANDOFF_VALIDATION_STATUS.UNKNOWN
          ? 'handoff_checksum_unknown'
          : 'handoff_checksum_mismatch',
      handoff: serializePhase22TrainingHandoff(handoff),
      ...checksum,
      domain: getTrainingDomainContract(),
    };
  }

  const payload = payloadOf(handoff);
  const customerId = payload.customerId || payload.platformCustomerId || null;
  const tenantId = payload.tenantId || null;
  const subscriptionId =
    payload.subscriptionId || payload.accountSubscriptionId || null;
  const missing = [];
  if (!customerId) missing.push('customerId');
  if (!tenantId) missing.push('tenantId');
  if (!subscriptionId) missing.push('subscriptionId');
  if (!handoff.projectId && !payload.projectId) missing.push('projectId');

  if (missing.length) {
    return {
      ok: false,
      error: `missing_required_pins: ${missing.join(',')}`,
      missing,
      handoff: serializePhase22TrainingHandoff(handoff),
      checksumValid: true,
      validationStatus: TRAINING_HANDOFF_VALIDATION_STATUS.CORRECTION_REQUIRED,
      expectedChecksumSha256: checksum.expectedChecksumSha256,
      storedChecksumSha256: checksum.storedChecksumSha256,
      domain: getTrainingDomainContract(),
    };
  }

  let validationStatus = TRAINING_HANDOFF_VALIDATION_STATUS.VALID;
  const warnings = [];
  if (payload.goLiveDependency === true && !payload.dates) {
    validationStatus = TRAINING_HANDOFF_VALIDATION_STATUS.VALID_WITH_WARNINGS;
    warnings.push('go_live_dependency_without_dates');
  }

  return {
    ok: true,
    handoff: serializePhase22TrainingHandoff(handoff),
    checksumValid: true,
    validationStatus,
    warnings,
    expectedChecksumSha256: checksum.expectedChecksumSha256,
    storedChecksumSha256: checksum.storedChecksumSha256,
    trainingCompleted: false,
    programCreated: false,
    domain: getTrainingDomainContract(),
  };
}

/**
 * Typed handoff execution update — only NOT_STARTED → IN_PROGRESS.
 * Never COMPLETED / fabricated trainingCompleted.
 */
export async function acknowledgeTrainingHandoffInProgress(prisma, args = {}) {
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
  if (handoff.handoffType !== CRM_CONVERSION_HANDOFF_TYPE.TRAINING) {
    return { ok: false, error: 'handoff_type_not_training' };
  }

  const current = String(handoff.executionStatus || '').toUpperCase();
  if (current === CRM_CONVERSION_HANDOFF_EXECUTION.COMPLETED) {
    return {
      ok: false,
      error: 'handoff_execution_completed_forbidden_from_training',
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
    trainingCompleted: false,
  };
}

/**
 * Auto-create TRQ Request from legacy CRM TRAINING handoff (idempotent).
 * Source stored as PHASE_16 alias (maps → PHASE_21 via resolveTrainingRequestSource).
 */
export async function consumeTrainingHandoff(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'training_handoff_consume_forbidden',
    };
  }
  if (!hasCustomerTrainingRequestModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_request_model_unavailable',
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
    : `trq-from-handoff:${handoffId}`;
  if (!idempotencyKey) {
    return { ok: false, error: 'idempotency_key_required' };
  }

  const handoff = await prisma.crmConversionDomainHandoff.findUnique({
    where: { id: handoffId },
  });
  if (!handoff) {
    return { ok: false, notFound: true, error: 'handoff_not_found' };
  }
  if (handoff.handoffType !== CRM_CONVERSION_HANDOFF_TYPE.TRAINING) {
    return {
      ok: false,
      error: 'handoff_type_not_training',
      handoffType: handoff.handoffType,
    };
  }

  const payload =
    handoff.payloadJson && typeof handoff.payloadJson === 'object'
      ? handoff.payloadJson
      : {};

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
  const onboardingProjectId =
    args.onboardingProjectId ||
    payload.onboardingProjectId ||
    payload.onboardingId ||
    null;

  const created = await createTrainingRequest(prisma, {
    ...args,
    admin,
    actorContext: args.actorContext || { admin },
    source: TRAINING_REQUEST_SOURCE.PHASE_16_TRAINING_HANDOFF,
    trainingType: args.trainingType || TRAINING_TYPE.CUSTOMER_ONBOARDING,
    handoffId: handoff.id,
    conversionId,
    onboardingProjectId,
    customerId,
    tenantId,
    subscriptionId,
    payloadJson: {
      ...payload,
      trainingCompleted: false,
      fabricatedComplete: false,
      executionComplete: false,
      handoffType: CRM_CONVERSION_HANDOFF_TYPE.TRAINING,
      sourceAliasOf: TRAINING_REQUEST_SOURCE.PHASE_21_TRAINING_HANDOFF,
    },
    idempotencyKey,
  });

  if (!created.ok) return created;

  const ack = await acknowledgeTrainingHandoffInProgress(prisma, {
    handoffId: handoff.id,
    now: args.now,
  });

  return {
    ...created,
    handoffId: handoff.id,
    handoffExecutionStatus:
      ack?.handoff?.executionStatus ||
      CRM_CONVERSION_HANDOFF_EXECUTION.IN_PROGRESS,
    trainingCompleted: false,
    fabricatedComplete: false,
    domain: getTrainingDomainContract(),
  };
}

async function markHandoffAcceptedByTraining(prisma, args = {}) {
  const {
    handoff,
    admin,
    acceptanceNotes,
    idempotencyKey,
    acceptInputHash,
    requestId,
    now,
  } = args;
  const prev = payloadOf(handoff);
  const nextPayload = {
    ...prev,
    supersessionHistory: Array.isArray(prev.supersessionHistory)
      ? prev.supersessionHistory
      : prev.supersessionHistory || undefined,
    trainingAcceptance: {
      ...(prev.trainingAcceptance && typeof prev.trainingAcceptance === 'object'
        ? prev.trainingAcceptance
        : {}),
      acceptedAt: (now || new Date()).toISOString(),
      acceptedByAdminId: admin?.id || null,
      acceptanceNotes:
        acceptanceNotes != null ? String(acceptanceNotes).slice(0, 2000) : null,
      idempotencyKey: idempotencyKey || null,
      inputHash: acceptInputHash || null,
      requestId: requestId || null,
    },
    trainingCompleted: false,
    fabricatedComplete: false,
    createsPrograms: false,
    createsSessions: false,
    createsAttendance: false,
    createsCertificates: false,
  };

  const updated = await prisma.customerOnboardingPhase22TrainingHandoff.update({
    where: { id: handoff.id },
    data: {
      status: PHASE22_TRAINING_HANDOFF_STATUS.ACCEPTED_BY_TRAINING,
      payloadJson: nextPayload,
      updatedAt: now || new Date(),
    },
  });

  return { ok: true, handoff: serializePhase22TrainingHandoff(updated) };
}

/**
 * Accept a validated Phase 21 → Phase 22 Training handoff (design §§4–7).
 * Authorise → portfolio fail-closed → checksum VALID → no duplicate active
 * Program purpose → create Request (PHASE_21_TRAINING_HANDOFF) →
 * mark ACCEPTED_BY_TRAINING. Exact retry same. Does not create Program/Sessions.
 */
export async function acceptTrainingHandoff(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'training_handoff_accept_forbidden',
      validationStatus: TRAINING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
      checksumValid: false,
    };
  }
  if (!hasCustomerOnboardingPhase22TrainingHandoffModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_phase22_training_handoff_model_unavailable',
      status: 'UNAVAILABLE',
      validationStatus: TRAINING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
      checksumValid: false,
    };
  }
  if (!hasCustomerTrainingRequestModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_request_model_unavailable',
      status: 'UNAVAILABLE',
      validationStatus: TRAINING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
      checksumValid: false,
    };
  }

  const handoffId = args.handoffId ? String(args.handoffId).trim() : '';
  if (!handoffId) {
    return {
      ok: false,
      error: 'handoff_id_required',
      validationStatus: TRAINING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
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
      validationStatus: TRAINING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
      checksumValid: false,
    };
  }

  const handoff = await prisma.customerOnboardingPhase22TrainingHandoff.findUnique({
    where: { id: handoffId },
  });
  if (!handoff) {
    return {
      ok: false,
      notFound: true,
      error: 'handoff_not_found',
      validationStatus: TRAINING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
      checksumValid: false,
    };
  }

  const statusUpper = String(handoff.status || '').toUpperCase();
  if (statusUpper === PHASE22_TRAINING_HANDOFF_STATUS.SUPERSEDED) {
    return {
      ok: false,
      error: 'handoff_superseded',
      handoff: serializePhase22TrainingHandoff(handoff),
      validationStatus: TRAINING_HANDOFF_VALIDATION_STATUS.SUPERSEDED,
      checksumValid: false,
    };
  }
  if (statusUpper === PHASE22_TRAINING_HANDOFF_STATUS.CORRECTION_REQUIRED) {
    return {
      ok: false,
      error: 'handoff_correction_required',
      handoff: serializePhase22TrainingHandoff(handoff),
      validationStatus: TRAINING_HANDOFF_VALIDATION_STATUS.CORRECTION_REQUIRED,
      checksumValid: false,
    };
  }

  const payload = payloadOf(handoff);
  const tenantId = payload.tenantId || null;

  const scopeGate = await assertTrainingTenantInPortfolioScope(
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
        validationStatus: TRAINING_HANDOFF_VALIDATION_STATUS.CORRECTION_REQUIRED,
        checksumValid: false,
      };
    }
  }

  const validated = await validateTrainingHandoff(prisma, {
    ...args,
    admin,
    handoffId,
  });
  if (!validated.ok || !isAcceptableValidationStatus(validated.validationStatus)) {
    return {
      ...validated,
      ok: false,
      error: validated.error || 'handoff_validation_failed',
      validationStatus:
        validated.validationStatus || TRAINING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
      checksumValid: validated.checksumValid === true,
    };
  }
  if (
    validated.validationStatus === TRAINING_HANDOFF_VALIDATION_STATUS.UNKNOWN
  ) {
    return {
      ok: false,
      error: 'handoff_checksum_unknown',
      validationStatus: TRAINING_HANDOFF_VALIDATION_STATUS.UNKNOWN,
      checksumValid: false,
    };
  }

  const customerId = payload.customerId || payload.platformCustomerId || null;
  const trainingType = args.trainingType || TRAINING_TYPE.CUSTOMER_ONBOARDING;
  const activePurpose = await findActiveProgramForPurpose(prisma, {
    customerId,
    tenantId,
    trainingType,
  });
  if (activePurpose) {
    return {
      ok: false,
      error: 'duplicate_active_program_purpose',
      existingProgramId: activePurpose.id,
      existingProgramNumber: activePurpose.programNumber || null,
      trainingType,
      customerId,
      tenantId,
      validationStatus: validated.validationStatus,
      checksumValid: true,
      domain: getTrainingDomainContract(),
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

  if (typeof prisma.customerTrainingRequest.findUnique === 'function') {
    try {
      const existingByKey = await prisma.customerTrainingRequest.findUnique({
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
        if (statusUpper !== PHASE22_TRAINING_HANDOFF_STATUS.ACCEPTED_BY_TRAINING) {
          await markHandoffAcceptedByTraining(prisma, {
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
          request: serializeTrainingRequest(existingByKey),
          handoff: serializePhase22TrainingHandoff(
            (await prisma.customerOnboardingPhase22TrainingHandoff.findUnique({
              where: { id: handoffId },
            })) || handoff
          ),
          alreadyExists: true,
          idempotentReplay: true,
          alreadyAccepted: true,
          checksumValid: true,
          validationStatus: validated.validationStatus,
          trainingCompleted: false,
          programCreated: false,
          domain: getTrainingDomainContract(),
        };
      }
    } catch {
      // continue
    }
  }

  if (statusUpper === PHASE22_TRAINING_HANDOFF_STATUS.ACCEPTED_BY_TRAINING) {
    const existingReq = await prisma.customerTrainingRequest.findFirst({
      where: {
        handoffId,
        source: TRAINING_REQUEST_SOURCE.PHASE_21_TRAINING_HANDOFF,
      },
    });
    if (existingReq) {
      return {
        ok: true,
        request: serializeTrainingRequest(existingReq),
        handoff: serializePhase22TrainingHandoff(handoff),
        alreadyAccepted: true,
        idempotentReplay: true,
        checksumValid: true,
        validationStatus: validated.validationStatus,
        trainingCompleted: false,
        programCreated: false,
        domain: getTrainingDomainContract(),
      };
    }
  }

  const subscriptionId =
    payload.subscriptionId || payload.accountSubscriptionId || null;
  const onboardingProjectId =
    handoff.projectId || payload.projectId || args.onboardingProjectId || null;

  const created = await createTrainingRequest(prisma, {
    ...args,
    admin,
    actorContext: args.actorContext || { admin },
    source: TRAINING_REQUEST_SOURCE.PHASE_21_TRAINING_HANDOFF,
    trainingType,
    handoffId: handoff.id,
    onboardingProjectId,
    customerId,
    tenantId,
    subscriptionId,
    payloadJson: {
      ...payload,
      trainingCompleted: false,
      fabricatedComplete: false,
      createsPrograms: false,
      createsSessions: false,
      createsAttendance: false,
      createsCertificates: false,
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
    idempotencyKey,
  });

  if (!created.ok) {
    return created;
  }

  const marked = await markHandoffAcceptedByTraining(prisma, {
    handoff,
    admin,
    acceptanceNotes: args.acceptanceNotes,
    idempotencyKey,
    acceptInputHash,
    requestId: created.request?.id || null,
    now,
  });

  const freshRequest = created.request?.id
    ? await prisma.customerTrainingRequest.findUnique({
        where: { id: created.request.id },
      })
    : null;

  return {
    ok: true,
    request: serializeTrainingRequest(freshRequest || created.request),
    handoff: marked.handoff || serializePhase22TrainingHandoff(handoff),
    alreadyExists: created.alreadyExists || false,
    idempotentReplay: created.idempotentReplay || false,
    checksumValid: true,
    validationStatus: validated.validationStatus,
    trainingCompleted: false,
    fabricatedComplete: false,
    programCreated: false,
    domain: getTrainingDomainContract(),
  };
}

export { TRAINING_HANDOFF_VALIDATION_STATUS };
