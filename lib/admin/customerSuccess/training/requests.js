/**
 * Customer Training Requests (TRQ-YYYY-######) — Phase 18 Wave 1.
 */

import { createHash } from 'crypto';
import {
  TRAINING_REQUEST_SOURCE,
  TRAINING_REQUEST_STATUS,
  TRAINING_TYPE,
  getTrainingDomainContract,
} from './catalogue.js';
import { allocateTrainingRequestNumber } from './numbering.js';
import {
  canManageTraining,
  canViewTraining,
  hasCustomerTrainingRequestModel,
  resolveTrainingActor,
  serializeTrainingRequest,
} from './model.js';
import { transitionTrainingRequestStatus } from './status.js';
import {
  resolveTrainingListScope,
  tenantWhereFromScope,
} from './listScope.js';

function hashRequestInput(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function requestMissingPins(row) {
  const missing = [];
  if (!row?.customerId) missing.push('customerId');
  if (!row?.tenantId) missing.push('tenantId');
  if (!row?.subscriptionId) missing.push('subscriptionId');
  return missing;
}

async function loadRequest(prisma, requestId) {
  const id = requestId ? String(requestId).trim() : '';
  if (!id || !hasCustomerTrainingRequestModel(prisma)) return null;
  try {
    if (/^TRQ-\d{4}-\d{6}$/.test(id)) {
      return await prisma.customerTrainingRequest.findUnique({
        where: { requestNumber: id },
      });
    }
    return await prisma.customerTrainingRequest.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

/**
 * Create a Training Request (manual or internal). Prefer consumeTrainingHandoff for Phase 16.
 */
export async function createTrainingRequest(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'training_request_create_forbidden',
    };
  }
  if (!hasCustomerTrainingRequestModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_request_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const now = args.now || new Date();
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;

  const inputPayload = {
    source: args.source || null,
    handoffId: args.handoffId || null,
    conversionId: args.conversionId || null,
    customerId: args.customerId || null,
    tenantId: args.tenantId || null,
    subscriptionId: args.subscriptionId || null,
  };
  const inputHash = hashRequestInput(inputPayload);

  if (idempotencyKey) {
    try {
      const existing = await prisma.customerTrainingRequest.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        if (existing.inputHash && existing.inputHash !== inputHash) {
          return {
            ok: false,
            error: 'idempotency_conflict',
            existingInputHash: existing.inputHash,
            attemptedInputHash: inputHash,
          };
        }
        return {
          ok: true,
          request: serializeTrainingRequest(existing),
          alreadyExists: true,
          idempotentReplay: true,
          trainingCompleted: false,
          domain: getTrainingDomainContract(),
        };
      }
    } catch {
      // continue
    }
  }

  const allocated = await allocateTrainingRequestNumber(prisma, { now });
  if (!allocated.ok) {
    return {
      ok: false,
      error: allocated.error || 'training_request_number_allocation_failed',
    };
  }

  let row;
  try {
    row = await prisma.customerTrainingRequest.create({
      data: {
        requestNumber: allocated.number,
        status: args.status || TRAINING_REQUEST_STATUS.NEW,
        source: args.source || TRAINING_REQUEST_SOURCE.MANUAL_APPROVED,
        trainingType: args.trainingType || TRAINING_TYPE.CUSTOMER_ONBOARDING,
        handoffId: args.handoffId ? String(args.handoffId).trim() : null,
        conversionId: args.conversionId ? String(args.conversionId).trim() : null,
        onboardingProjectId: args.onboardingProjectId
          ? String(args.onboardingProjectId).trim()
          : null,
        customerId: args.customerId ? String(args.customerId).trim() : null,
        tenantId: args.tenantId ? String(args.tenantId).trim() : null,
        subscriptionId: args.subscriptionId
          ? String(args.subscriptionId).trim()
          : null,
        payloadJson: args.payloadJson ?? args.payload ?? null,
        ownerAdminId: args.ownerAdminId || admin?.id || null,
        createdByAdminId: admin?.id || null,
        inputHash,
        idempotencyKey,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    if (idempotencyKey) {
      try {
        const raced = await prisma.customerTrainingRequest.findUnique({
          where: { idempotencyKey },
        });
        if (raced) {
          if (raced.inputHash && raced.inputHash !== inputHash) {
            return {
              ok: false,
              error: 'idempotency_conflict',
              existingInputHash: raced.inputHash,
              attemptedInputHash: inputHash,
            };
          }
          return {
            ok: true,
            request: serializeTrainingRequest(raced),
            alreadyExists: true,
            idempotentReplay: true,
            trainingCompleted: false,
            domain: getTrainingDomainContract(),
          };
        }
      } catch {
        // fall through
      }
    }
    return { ok: false, error: err?.message || 'training_request_create_failed' };
  }

  return {
    ok: true,
    request: serializeTrainingRequest(row),
    trainingCompleted: false,
    domain: getTrainingDomainContract(),
  };
}

/**
 * Validate Request pins (Customer + Tenant + Subscription). Moves NEW → READY when valid.
 */
export async function validateTrainingRequest(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_request_validate_forbidden' };
  }

  const row = await loadRequest(prisma, args.trainingRequestId || args.requestId);
  if (!row) {
    return { ok: false, notFound: true, error: 'training_request_not_found' };
  }

  const missing = requestMissingPins(row);
  if (missing.length) {
    return {
      ok: false,
      error: `missing_required_pins: ${missing.join(',')}`,
      missing,
      request: serializeTrainingRequest(row),
    };
  }

  if (
    row.status === TRAINING_REQUEST_STATUS.READY ||
    row.status === TRAINING_REQUEST_STATUS.ACCEPTED ||
    row.status === TRAINING_REQUEST_STATUS.CONVERTED_TO_PROGRAM
  ) {
    return {
      ok: true,
      request: serializeTrainingRequest(row),
      alreadyValid: true,
      domain: getTrainingDomainContract(),
    };
  }

  return transitionTrainingRequestStatus(prisma, {
    ...args,
    admin,
    trainingRequestId: row.id,
    toStatus: TRAINING_REQUEST_STATUS.READY,
    reason: args.reason || 'validated_pins',
  });
}

export async function acceptTrainingRequest(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_request_accept_forbidden' };
  }

  const row = await loadRequest(prisma, args.trainingRequestId || args.requestId);
  if (!row) {
    return { ok: false, notFound: true, error: 'training_request_not_found' };
  }

  const missing = requestMissingPins(row);
  if (missing.length) {
    return {
      ok: false,
      error: `missing_required_pins: ${missing.join(',')}`,
      missing,
    };
  }

  if (row.status === TRAINING_REQUEST_STATUS.ACCEPTED) {
    return {
      ok: true,
      request: serializeTrainingRequest(row),
      alreadyAccepted: true,
      domain: getTrainingDomainContract(),
    };
  }

  if (row.status !== TRAINING_REQUEST_STATUS.READY) {
    if (
      row.status === TRAINING_REQUEST_STATUS.NEW ||
      row.status === TRAINING_REQUEST_STATUS.VALIDATING ||
      row.status === TRAINING_REQUEST_STATUS.INFORMATION_REQUIRED
    ) {
      const validated = await validateTrainingRequest(prisma, {
        ...args,
        admin,
        trainingRequestId: row.id,
      });
      if (!validated.ok) return validated;
    } else {
      return {
        ok: false,
        error: `invalid_status_for_accept: ${row.status}`,
      };
    }
  }

  return transitionTrainingRequestStatus(prisma, {
    ...args,
    admin,
    trainingRequestId: row.id,
    toStatus: TRAINING_REQUEST_STATUS.ACCEPTED,
    reason: args.reason || 'accepted',
  });
}

export async function rejectTrainingRequest(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_request_reject_forbidden' };
  }

  const row = await loadRequest(prisma, args.trainingRequestId || args.requestId);
  if (!row) {
    return { ok: false, notFound: true, error: 'training_request_not_found' };
  }

  return transitionTrainingRequestStatus(prisma, {
    ...args,
    admin,
    trainingRequestId: row.id,
    toStatus: TRAINING_REQUEST_STATUS.REJECTED,
    reason: args.reason || 'rejected',
  });
}

export async function listTrainingRequests(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canViewTraining(admin) && !canManageTraining(admin)) {
    return {
      ok: false,
      forbidden: true,
      error: 'training_list_forbidden',
      requests: [],
    };
  }
  if (!hasCustomerTrainingRequestModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_request_model_unavailable',
      status: 'UNAVAILABLE',
      requests: [],
    };
  }

  const scopeResult = await resolveTrainingListScope(prisma, admin, args);
  if (!scopeResult.ok) {
    if (scopeResult.forbidden) {
      return {
        ok: false,
        forbidden: true,
        error: 'training_list_forbidden',
        requests: [],
      };
    }
    return {
      ok: true,
      requests: [],
      reason: scopeResult.reason,
      meta: { portfolioScoped: true, failClosed: true },
      domain: getTrainingDomainContract(),
    };
  }

  const where = { ...tenantWhereFromScope(scopeResult.tenantScope) };
  const rows = await prisma.customerTrainingRequest.findMany({ where });
  return {
    ok: true,
    requests: rows.map(serializeTrainingRequest),
    meta: {
      portfolioScoped: scopeResult.portfolioScoped,
      failClosed: scopeResult.portfolioScoped,
    },
    domain: getTrainingDomainContract(),
  };
}

export { loadRequest as loadTrainingRequest };
