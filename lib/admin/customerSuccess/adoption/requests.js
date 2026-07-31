/**
 * Customer Adoption Requests (ADR-YYYY-######) — Phase 19 Wave 1.
 */

import { createHash } from 'crypto';
import {
  ADOPTION_REQUEST_SOURCE,
  ADOPTION_REQUEST_STATUS,
  getAdoptionDomainContract,
} from './catalogue.js';
import { allocateAdoptionRequestNumber } from './numbering.js';
import {
  canManageAdoption,
  canViewAdoption,
  hasCustomerAdoptionRequestModel,
  resolveAdoptionActor,
  serializeAdoptionRequest,
} from './model.js';
import { transitionAdoptionRequestStatus } from './status.js';
import {
  assertAdoptionTenantInScope,
  resolveAdoptionListScope,
  tenantWhereFromScope,
} from './listScope.js';
import { loadAdoptionRequestForActor } from './planAccess.js';

function hashRequestInput(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function requestMissingPins(row) {
  const missing = [];
  if (!row?.customerId) missing.push('customerId');
  if (!row?.tenantId) missing.push('tenantId');
  return missing;
}

async function loadRequest(prisma, requestId) {
  const id = requestId ? String(requestId).trim() : '';
  if (!id || !hasCustomerAdoptionRequestModel(prisma)) return null;
  try {
    if (/^ADR-\d{4}-\d{6}$/.test(id)) {
      return await prisma.customerAdoptionRequest.findUnique({
        where: { requestNumber: id },
      });
    }
    return await prisma.customerAdoptionRequest.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

/**
 * Create Adoption Request (manual / internal). Prefer consumeTrainingCompletionForAdoption for auto.
 */
export async function createAdoptionRequest(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'adoption_request_create_forbidden',
    };
  }
  if (!hasCustomerAdoptionRequestModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_request_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const writeTenantId =
    args.tenantId != null && String(args.tenantId).trim()
      ? String(args.tenantId).trim()
      : null;
  const scopeGate = await assertAdoptionTenantInScope(
    prisma,
    admin,
    args,
    writeTenantId
  );
  if (!scopeGate.ok) return scopeGate;

  const now = args.now || new Date();
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;

  const inputPayload = {
    source: args.source || null,
    trainingProgramId: args.trainingProgramId || null,
    onboardingHandoverId: args.onboardingHandoverId || null,
    customerId: args.customerId || null,
    tenantId: args.tenantId || null,
    subscriptionId: args.subscriptionId || null,
  };
  const inputHash = hashRequestInput(inputPayload);

  if (idempotencyKey) {
    try {
      const existing = await prisma.customerAdoptionRequest.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        const existingScope = await assertAdoptionTenantInScope(
          prisma,
          admin,
          args,
          existing.tenantId
        );
        if (!existingScope.ok) return existingScope;
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
          request: serializeAdoptionRequest(existing),
          alreadyExists: true,
          idempotentReplay: true,
          trainingCompleted: false,
          domain: getAdoptionDomainContract(),
        };
      }
    } catch {
      // continue
    }
  }

  if (args.trainingProgramId) {
    try {
      const byProgram = await prisma.customerAdoptionRequest.findFirst({
        where: {
          trainingProgramId: String(args.trainingProgramId),
          source: ADOPTION_REQUEST_SOURCE.PHASE_18_TRAINING_COMPLETED,
        },
      });
      if (byProgram) {
        const existingScope = await assertAdoptionTenantInScope(
          prisma,
          admin,
          args,
          byProgram.tenantId
        );
        if (!existingScope.ok) return existingScope;
        return {
          ok: true,
          request: serializeAdoptionRequest(byProgram),
          alreadyExists: true,
          idempotentReplay: true,
          trainingCompleted: false,
          domain: getAdoptionDomainContract(),
        };
      }
    } catch {
      // continue
    }
  }

  const allocated = await allocateAdoptionRequestNumber(prisma, { now });
  if (!allocated.ok) {
    return {
      ok: false,
      error: allocated.error || 'adoption_request_number_allocation_failed',
    };
  }

  let row;
  try {
    row = await prisma.customerAdoptionRequest.create({
      data: {
        requestNumber: allocated.number,
        status: args.status || ADOPTION_REQUEST_STATUS.NEW,
        source: args.source || ADOPTION_REQUEST_SOURCE.CUSTOMER_SUCCESS_MANUAL,
        trainingProgramId: args.trainingProgramId
          ? String(args.trainingProgramId).trim()
          : null,
        onboardingProjectId: args.onboardingProjectId
          ? String(args.onboardingProjectId).trim()
          : null,
        onboardingHandoverId: args.onboardingHandoverId
          ? String(args.onboardingHandoverId).trim()
          : null,
        customerId: args.customerId ? String(args.customerId).trim() : null,
        tenantId: args.tenantId ? String(args.tenantId).trim() : null,
        subscriptionId: args.subscriptionId
          ? String(args.subscriptionId).trim()
          : null,
        targetRolesJson: args.targetRolesJson ?? args.targetRoles ?? null,
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
    try {
      if (idempotencyKey) {
        const raced = await prisma.customerAdoptionRequest.findUnique({
          where: { idempotencyKey },
        });
        if (raced) {
          const racedScope = await assertAdoptionTenantInScope(
            prisma,
            admin,
            args,
            raced.tenantId
          );
          if (!racedScope.ok) return racedScope;
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
            request: serializeAdoptionRequest(raced),
            alreadyExists: true,
            idempotentReplay: true,
            trainingCompleted: false,
            domain: getAdoptionDomainContract(),
          };
        }
      }
      // Concurrent consumes with different idempotency keys: recover by program+source.
      const trainingProgramId = args.trainingProgramId
        ? String(args.trainingProgramId).trim()
        : null;
      const source =
        args.source || ADOPTION_REQUEST_SOURCE.CUSTOMER_SUCCESS_MANUAL;
      if (
        trainingProgramId &&
        source === ADOPTION_REQUEST_SOURCE.PHASE_18_TRAINING_COMPLETED
      ) {
        const byProgram = await prisma.customerAdoptionRequest.findFirst({
          where: {
            trainingProgramId,
            source: ADOPTION_REQUEST_SOURCE.PHASE_18_TRAINING_COMPLETED,
          },
        });
        if (byProgram) {
          const byProgramScope = await assertAdoptionTenantInScope(
            prisma,
            admin,
            args,
            byProgram.tenantId
          );
          if (!byProgramScope.ok) return byProgramScope;
          return {
            ok: true,
            request: serializeAdoptionRequest(byProgram),
            alreadyExists: true,
            idempotentReplay: true,
            trainingCompleted: false,
            domain: getAdoptionDomainContract(),
          };
        }
      }
    } catch {
      // fall through
    }
    return { ok: false, error: err?.message || 'adoption_request_create_failed' };
  }

  return {
    ok: true,
    request: serializeAdoptionRequest(row),
    trainingCompleted: false,
    domain: getAdoptionDomainContract(),
  };
}

export async function createManualAdoptionRequest(prisma, args = {}) {
  return createAdoptionRequest(prisma, {
    ...args,
    source: args.source || ADOPTION_REQUEST_SOURCE.CUSTOMER_SUCCESS_MANUAL,
  });
}

export async function validateAdoptionRequest(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return { ok: false, forbidden: true, reason: 'adoption_request_validate_forbidden' };
  }

  const loaded = await loadRequest(prisma, args.adoptionRequestId || args.requestId);
  if (!loaded) {
    return { ok: false, notFound: true, error: 'adoption_request_not_found' };
  }

  // Always portfolio/tenant scope before returning any ADR payload (incl. idempotent).
  const access = await loadAdoptionRequestForActor(prisma, {
    ...args,
    admin,
    adoptionRequestId: loaded.id,
    requestId: loaded.id,
  });
  if (!access.ok) return access;
  const row = access.requestRow || loaded;

  const missing = requestMissingPins(row);
  if (missing.length) {
    return {
      ok: false,
      error: `missing_required_pins: ${missing.join(',')}`,
      missing,
      request: serializeAdoptionRequest(row),
    };
  }

  if (
    row.status === ADOPTION_REQUEST_STATUS.READY ||
    row.status === ADOPTION_REQUEST_STATUS.ACCEPTED ||
    row.status === ADOPTION_REQUEST_STATUS.CONVERTED_TO_PLAN
  ) {
    return {
      ok: true,
      request: serializeAdoptionRequest(row),
      alreadyValid: true,
      domain: getAdoptionDomainContract(),
    };
  }

  return transitionAdoptionRequestStatus(prisma, {
    ...args,
    admin,
    adoptionRequestId: row.id,
    toStatus: ADOPTION_REQUEST_STATUS.READY,
    reason: args.reason || 'validated_pins',
  });
}

export async function acceptAdoptionRequest(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return { ok: false, forbidden: true, reason: 'adoption_request_accept_forbidden' };
  }

  const loaded = await loadRequest(prisma, args.adoptionRequestId || args.requestId);
  if (!loaded) {
    return { ok: false, notFound: true, error: 'adoption_request_not_found' };
  }

  // Always portfolio/tenant scope before returning any ADR payload (incl. idempotent).
  const access = await loadAdoptionRequestForActor(prisma, {
    ...args,
    admin,
    adoptionRequestId: loaded.id,
    requestId: loaded.id,
  });
  if (!access.ok) return access;
  const row = access.requestRow || loaded;

  const missing = requestMissingPins(row);
  if (missing.length) {
    return {
      ok: false,
      error: `missing_required_pins: ${missing.join(',')}`,
      missing,
    };
  }

  if (row.status === ADOPTION_REQUEST_STATUS.ACCEPTED) {
    return {
      ok: true,
      request: serializeAdoptionRequest(row),
      alreadyAccepted: true,
      domain: getAdoptionDomainContract(),
    };
  }

  if (row.status !== ADOPTION_REQUEST_STATUS.READY) {
    if (
      row.status === ADOPTION_REQUEST_STATUS.NEW ||
      row.status === ADOPTION_REQUEST_STATUS.VALIDATING ||
      row.status === ADOPTION_REQUEST_STATUS.INFORMATION_REQUIRED
    ) {
      const validated = await validateAdoptionRequest(prisma, {
        ...args,
        admin,
        adoptionRequestId: row.id,
      });
      if (!validated.ok) return validated;
    } else {
      return {
        ok: false,
        error: `invalid_status_for_accept: ${row.status}`,
      };
    }
  }

  return transitionAdoptionRequestStatus(prisma, {
    ...args,
    admin,
    adoptionRequestId: row.id,
    toStatus: ADOPTION_REQUEST_STATUS.ACCEPTED,
    reason: args.reason || 'accepted',
  });
}

export async function rejectAdoptionRequest(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return { ok: false, forbidden: true, reason: 'adoption_request_reject_forbidden' };
  }

  const row = await loadRequest(prisma, args.adoptionRequestId || args.requestId);
  if (!row) {
    return { ok: false, notFound: true, error: 'adoption_request_not_found' };
  }

  return transitionAdoptionRequestStatus(prisma, {
    ...args,
    admin,
    adoptionRequestId: row.id,
    toStatus: ADOPTION_REQUEST_STATUS.REJECTED,
    reason: args.reason || 'rejected',
  });
}

export async function listAdoptionRequests(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canViewAdoption(admin) && !canManageAdoption(admin)) {
    return {
      ok: false,
      forbidden: true,
      error: 'adoption_list_forbidden',
      requests: [],
    };
  }
  if (!hasCustomerAdoptionRequestModel(prisma)) {
    return {
      ok: false,
      error: 'customer_adoption_request_model_unavailable',
      status: 'UNAVAILABLE',
      requests: [],
    };
  }

  const scopeResult = await resolveAdoptionListScope(prisma, admin, args);
  if (!scopeResult.ok) {
    if (scopeResult.forbidden) {
      return {
        ok: false,
        forbidden: true,
        error: 'adoption_list_forbidden',
        requests: [],
      };
    }
    return {
      ok: true,
      requests: [],
      reason: scopeResult.reason,
      meta: { portfolioScoped: true, failClosed: true },
      domain: getAdoptionDomainContract(),
    };
  }

  const where = { ...tenantWhereFromScope(scopeResult.tenantScope) };
  const rows = await prisma.customerAdoptionRequest.findMany({ where });
  return {
    ok: true,
    requests: rows.map(serializeAdoptionRequest),
    meta: {
      portfolioScoped: scopeResult.portfolioScoped,
      failClosed: scopeResult.portfolioScoped,
    },
    domain: getAdoptionDomainContract(),
  };
}

export { loadRequest as loadAdoptionRequest };
