/**
 * Customer Onboarding Requests (ONR-YYYY-######) — Phase 17 Wave 1.
 */

import { createHash } from 'crypto';
import {
  ONBOARDING_REQUEST_SOURCE,
  ONBOARDING_REQUEST_STATUS,
  ONBOARDING_TYPE,
  getOnboardingDomainContract,
} from './catalogue.js';
import { allocateOnboardingRequestNumber } from './numbering.js';
import {
  canManageOnboarding,
  canViewOnboarding,
  hasCustomerOnboardingRequestModel,
  resolveOnboardingActor,
  serializeOnboardingRequest,
} from './model.js';
import { transitionOnboardingRequestStatus } from './status.js';
import {
  resolveOnboardingListScope,
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
  if (!id || !hasCustomerOnboardingRequestModel(prisma)) return null;
  try {
    if (/^ONR-\d{4}-\d{6}$/.test(id)) {
      return await prisma.customerOnboardingRequest.findUnique({
        where: { requestNumber: id },
      });
    }
    return await prisma.customerOnboardingRequest.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

/**
 * Create an Onboarding Request (manual or internal). Prefer consumeOnboardingHandoff for Phase 16.
 */
export async function createOnboardingRequest(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canManageOnboarding(admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'onboarding_request_create_forbidden',
    };
  }
  if (!hasCustomerOnboardingRequestModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_request_model_unavailable',
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
      const existing = await prisma.customerOnboardingRequest.findUnique({
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
          request: serializeOnboardingRequest(existing),
          alreadyExists: true,
          idempotentReplay: true,
          onboardingCompleted: false,
          domain: getOnboardingDomainContract(),
        };
      }
    } catch {
      // continue
    }
  }

  const allocated = await allocateOnboardingRequestNumber(prisma, { now });
  if (!allocated.ok) {
    return {
      ok: false,
      error: allocated.error || 'onboarding_request_number_allocation_failed',
    };
  }

  let row;
  try {
    row = await prisma.customerOnboardingRequest.create({
      data: {
        requestNumber: allocated.number,
        status: args.status || ONBOARDING_REQUEST_STATUS.NEW,
        source: args.source || ONBOARDING_REQUEST_SOURCE.MANUAL_APPROVED,
        onboardingType: args.onboardingType || ONBOARDING_TYPE.STANDARD,
        handoffId: args.handoffId ? String(args.handoffId).trim() : null,
        conversionId: args.conversionId ? String(args.conversionId).trim() : null,
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
        const raced = await prisma.customerOnboardingRequest.findUnique({
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
            request: serializeOnboardingRequest(raced),
            alreadyExists: true,
            idempotentReplay: true,
            onboardingCompleted: false,
            domain: getOnboardingDomainContract(),
          };
        }
      } catch {
        // fall through
      }
    }
    return { ok: false, error: err?.message || 'onboarding_request_create_failed' };
  }

  return {
    ok: true,
    request: serializeOnboardingRequest(row),
    onboardingCompleted: false,
    domain: getOnboardingDomainContract(),
  };
}

/**
 * Validate Request pins (Customer + Tenant + Subscription). Moves NEW → READY when valid.
 */
export async function validateOnboardingRequest(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canManageOnboarding(admin)) {
    return { ok: false, forbidden: true, reason: 'onboarding_request_validate_forbidden' };
  }

  const row = await loadRequest(prisma, args.onboardingRequestId || args.requestId);
  if (!row) {
    return { ok: false, notFound: true, error: 'onboarding_request_not_found' };
  }

  const missing = requestMissingPins(row);
  if (missing.length) {
    return {
      ok: false,
      error: `missing_required_pins: ${missing.join(',')}`,
      missing,
      request: serializeOnboardingRequest(row),
    };
  }

  if (
    row.status === ONBOARDING_REQUEST_STATUS.READY ||
    row.status === ONBOARDING_REQUEST_STATUS.ACCEPTED ||
    row.status === ONBOARDING_REQUEST_STATUS.CONVERTED_TO_PROJECT
  ) {
    return {
      ok: true,
      request: serializeOnboardingRequest(row),
      alreadyValid: true,
      domain: getOnboardingDomainContract(),
    };
  }

  return transitionOnboardingRequestStatus(prisma, {
    ...args,
    admin,
    onboardingRequestId: row.id,
    toStatus: ONBOARDING_REQUEST_STATUS.READY,
    reason: args.reason || 'validated_pins',
  });
}

export async function acceptOnboardingRequest(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canManageOnboarding(admin)) {
    return { ok: false, forbidden: true, reason: 'onboarding_request_accept_forbidden' };
  }

  const row = await loadRequest(prisma, args.onboardingRequestId || args.requestId);
  if (!row) {
    return { ok: false, notFound: true, error: 'onboarding_request_not_found' };
  }

  const missing = requestMissingPins(row);
  if (missing.length) {
    return {
      ok: false,
      error: `missing_required_pins: ${missing.join(',')}`,
      missing,
    };
  }

  if (row.status === ONBOARDING_REQUEST_STATUS.ACCEPTED) {
    return {
      ok: true,
      request: serializeOnboardingRequest(row),
      alreadyAccepted: true,
      domain: getOnboardingDomainContract(),
    };
  }

  if (row.status !== ONBOARDING_REQUEST_STATUS.READY) {
    // Auto-validate first when still NEW/VALIDATING
    if (
      row.status === ONBOARDING_REQUEST_STATUS.NEW ||
      row.status === ONBOARDING_REQUEST_STATUS.VALIDATING ||
      row.status === ONBOARDING_REQUEST_STATUS.INFORMATION_REQUIRED
    ) {
      const validated = await validateOnboardingRequest(prisma, {
        ...args,
        admin,
        onboardingRequestId: row.id,
      });
      if (!validated.ok) return validated;
    } else {
      return {
        ok: false,
        error: `invalid_status_for_accept: ${row.status}`,
      };
    }
  }

  return transitionOnboardingRequestStatus(prisma, {
    ...args,
    admin,
    onboardingRequestId: row.id,
    toStatus: ONBOARDING_REQUEST_STATUS.ACCEPTED,
    reason: args.reason || 'accepted',
  });
}

export async function rejectOnboardingRequest(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canManageOnboarding(admin)) {
    return { ok: false, forbidden: true, reason: 'onboarding_request_reject_forbidden' };
  }

  const row = await loadRequest(prisma, args.onboardingRequestId || args.requestId);
  if (!row) {
    return { ok: false, notFound: true, error: 'onboarding_request_not_found' };
  }

  return transitionOnboardingRequestStatus(prisma, {
    ...args,
    admin,
    onboardingRequestId: row.id,
    toStatus: ONBOARDING_REQUEST_STATUS.REJECTED,
    reason: args.reason || 'rejected',
  });
}

export async function listOnboardingRequests(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canViewOnboarding(admin) && !canManageOnboarding(admin)) {
    return {
      ok: false,
      forbidden: true,
      error: 'onboarding_list_forbidden',
      requests: [],
    };
  }
  if (!hasCustomerOnboardingRequestModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_request_model_unavailable',
      status: 'UNAVAILABLE',
      requests: [],
    };
  }

  const scopeResult = await resolveOnboardingListScope(prisma, admin, args);
  if (!scopeResult.ok) {
    if (scopeResult.forbidden) {
      return {
        ok: false,
        forbidden: true,
        error: 'onboarding_list_forbidden',
        requests: [],
      };
    }
    return {
      ok: true,
      requests: [],
      reason: scopeResult.reason,
      meta: { portfolioScoped: true, failClosed: true },
      domain: getOnboardingDomainContract(),
    };
  }

  const where = { ...tenantWhereFromScope(scopeResult.tenantScope) };
  const rows = await prisma.customerOnboardingRequest.findMany({ where });
  return {
    ok: true,
    requests: rows.map(serializeOnboardingRequest),
    meta: {
      portfolioScoped: scopeResult.portfolioScoped,
      failClosed: scopeResult.portfolioScoped,
    },
    domain: getOnboardingDomainContract(),
  };
}

export { loadRequest as loadOnboardingRequest };
