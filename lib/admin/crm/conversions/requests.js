/**
 * Conversion Requests (CVR-YYYY-######) — Phase 16 Wave 1.
 * Seeds from Phase 15 Closed-Won handoff. Never provisions Customer/Tenant/Subscription.
 */

import { resolveCrmAccess } from '../authz.js';
import { hasCrmClosedWonConversionHandoffModel } from '../commercial/readiness.js';
import {
  CRM_CONVERSION_REQUEST_SOURCE,
  CRM_CONVERSION_REQUEST_STATUS,
  CRM_CONVERSION_TYPE,
  getConversionDomainContract,
} from './catalogue.js';
import { allocateConversionRequestNumber } from './numbering.js';
import {
  hasCrmConversionRequestModel,
  resolveConversionActor,
  serializeConversionRequest,
} from './model.js';

async function loadRequest(prisma, requestId) {
  const id = requestId ? String(requestId).trim() : '';
  if (!id || !hasCrmConversionRequestModel(prisma)) return null;
  try {
    if (/^CVR-\d{4}-\d{6}$/.test(id)) {
      return await prisma.crmConversionRequest.findUnique({ where: { requestNumber: id } });
    }
    return await prisma.crmConversionRequest.findUnique({ where: { id } });
  } catch {
    return null;
  }
}

function canEditConversion(access) {
  return Boolean(
    access?.canEditOpportunities ||
      access?.canTransitionOpportunityStages ||
      access?.isSuperAdmin
  );
}

/**
 * Create a Conversion Request.
 */
export async function createConversionRequest(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const access = resolveCrmAccess(admin);
  if (!canEditConversion(access)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_conversion_request_create_forbidden',
    };
  }
  if (!hasCrmConversionRequestModel(prisma)) {
    return {
      ok: false,
      error: 'crm_conversion_request_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const now = args.now || new Date();
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;

  if (idempotencyKey) {
    try {
      const existing = await prisma.crmConversionRequest.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return {
          ok: true,
          request: serializeConversionRequest(existing),
          alreadyExists: true,
          idempotentReplay: true,
          customerCreated: false,
          tenantCreated: false,
          subscriptionCreated: false,
          invoiceCreated: false,
          domain: getConversionDomainContract(),
        };
      }
    } catch {
      // continue
    }
  }

  // Also idempotent by acceptance + handoff source
  const acceptanceId = args.acceptanceId ? String(args.acceptanceId).trim() : null;
  if (acceptanceId && args.source === CRM_CONVERSION_REQUEST_SOURCE.PHASE_15_ACCEPTANCE_HANDOFF) {
    const prior = await prisma.crmConversionRequest.findFirst({
      where: {
        acceptanceId,
        source: CRM_CONVERSION_REQUEST_SOURCE.PHASE_15_ACCEPTANCE_HANDOFF,
      },
    });
    if (prior) {
      return {
        ok: true,
        request: serializeConversionRequest(prior),
        alreadyExists: true,
        idempotentReplay: true,
        customerCreated: false,
        tenantCreated: false,
        subscriptionCreated: false,
        invoiceCreated: false,
        domain: getConversionDomainContract(),
      };
    }
  }

  const allocated = await allocateConversionRequestNumber(prisma, { now });
  if (!allocated.ok) {
    return {
      ok: false,
      error: allocated.error || 'conversion_request_number_allocation_failed',
    };
  }

  let row;
  try {
    row = await prisma.crmConversionRequest.create({
      data: {
        requestNumber: allocated.number,
        status: CRM_CONVERSION_REQUEST_STATUS.READY,
        source:
          args.source || CRM_CONVERSION_REQUEST_SOURCE.PHASE_15_ACCEPTANCE_HANDOFF,
        conversionType:
          args.conversionType || CRM_CONVERSION_TYPE.NEW_CUSTOMER_NEW_TENANT,
        acceptanceId,
        handoffId: args.handoffId ? String(args.handoffId).trim() : null,
        opportunityId: args.opportunityId
          ? String(args.opportunityId).trim()
          : null,
        accountId: args.accountId ? String(args.accountId).trim() : null,
        contactId: args.contactId ? String(args.contactId).trim() : null,
        documentVersionId: args.documentVersionId
          ? String(args.documentVersionId).trim()
          : null,
        checksumSha256: args.checksumSha256
          ? String(args.checksumSha256).trim()
          : null,
        currency: args.currency ? String(args.currency).trim().slice(0, 12) : null,
        payloadJson: args.payloadJson ?? args.payload ?? null,
        ownerAdminId: args.ownerAdminId || admin?.id || null,
        createdByAdminId: admin?.id || null,
        idempotencyKey,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    if (idempotencyKey) {
      try {
        const raced = await prisma.crmConversionRequest.findUnique({
          where: { idempotencyKey },
        });
        if (raced) {
          return {
            ok: true,
            request: serializeConversionRequest(raced),
            alreadyExists: true,
            idempotentReplay: true,
            customerCreated: false,
            tenantCreated: false,
            subscriptionCreated: false,
            invoiceCreated: false,
            domain: getConversionDomainContract(),
          };
        }
      } catch {
        // fall through
      }
    }
    return { ok: false, error: err?.message || 'conversion_request_create_failed' };
  }

  return {
    ok: true,
    request: serializeConversionRequest(row),
    customerCreated: false,
    tenantCreated: false,
    subscriptionCreated: false,
    invoiceCreated: false,
    domain: getConversionDomainContract(),
  };
}

/**
 * Consume Phase 15 Closed-Won handoff → create CVR idempotently.
 */
export async function createConversionRequestFromClosedWonHandoff(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const acceptanceId = args.acceptanceId ? String(args.acceptanceId).trim() : '';
  const handoffId = args.handoffId ? String(args.handoffId).trim() : '';

  if (!acceptanceId && !handoffId && !args.handoff) {
    return { ok: false, error: 'acceptanceId_or_handoff_required' };
  }

  let handoff = args.handoff || null;
  if (!handoff && hasCrmClosedWonConversionHandoffModel(prisma)) {
    if (handoffId) {
      handoff = await prisma.crmClosedWonConversionHandoff.findUnique({
        where: { id: handoffId },
      });
    } else if (acceptanceId) {
      handoff = await prisma.crmClosedWonConversionHandoff.findFirst({
        where: { acceptanceId },
      });
    }
  }

  if (!handoff && !acceptanceId) {
    return { ok: false, notFound: true, error: 'handoff_not_found' };
  }

  const payload = handoff?.payloadJson || args.payload || {};
  const resolvedAcceptanceId = acceptanceId || handoff?.acceptanceId || payload.acceptanceId;
  const idempotencyKey =
    args.idempotencyKey ||
    (resolvedAcceptanceId
      ? `cvr-from-handoff:${resolvedAcceptanceId}`
      : handoff?.idempotencyKey
        ? `cvr-from-handoff-key:${handoff.idempotencyKey}`
        : null);

  return createConversionRequest(prisma, {
    ...args,
    admin,
    actorContext: args.actorContext || { admin },
    source: CRM_CONVERSION_REQUEST_SOURCE.PHASE_15_ACCEPTANCE_HANDOFF,
    acceptanceId: resolvedAcceptanceId,
    handoffId: handoff?.id || handoffId || null,
    opportunityId:
      args.opportunityId || handoff?.opportunityId || payload.opportunityId || null,
    accountId: args.accountId || payload.accountId || null,
    contactId: args.contactId || payload.contactId || null,
    documentVersionId:
      args.documentVersionId ||
      handoff?.documentVersionId ||
      payload.documentVersionId ||
      null,
    checksumSha256: args.checksumSha256 || payload.checksumSha256 || null,
    currency: args.currency || payload.currency || null,
    payloadJson: payload,
    idempotencyKey,
  });
}

export async function validateConversionRequest(prisma, args = {}) {
  const row = await loadRequest(prisma, args.conversionRequestId || args.requestId);
  if (!row) return { ok: false, notFound: true, error: 'conversion_request_not_found' };

  const missing = [];
  if (!row.acceptanceId) missing.push('acceptanceId');
  if (!row.opportunityId) missing.push('opportunityId');

  if (missing.length) {
    return {
      ok: false,
      error: 'conversion_request_incomplete',
      missing,
      request: serializeConversionRequest(row),
      domain: getConversionDomainContract(),
    };
  }

  return {
    ok: true,
    valid: true,
    request: serializeConversionRequest(row),
    domain: getConversionDomainContract(),
  };
}

export async function approveConversionRequest(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const row = await loadRequest(prisma, args.conversionRequestId || args.requestId);
  if (!row) return { ok: false, notFound: true, error: 'conversion_request_not_found' };

  const now = args.now || new Date();
  const updated = await prisma.crmConversionRequest.update({
    where: { id: row.id },
    data: {
      status: CRM_CONVERSION_REQUEST_STATUS.READY,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    request: serializeConversionRequest(updated),
    approvedByAdminId: admin?.id || null,
    domain: getConversionDomainContract(),
  };
}

export async function listConversionRequests(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const access = resolveCrmAccess(admin);
  if (!access.canViewOpportunities && !access.isSuperAdmin && !access.canView) {
    return { ok: false, forbidden: true, reason: 'crm_conversion_request_list_forbidden' };
  }
  if (!hasCrmConversionRequestModel(prisma)) {
    return {
      ok: false,
      error: 'crm_conversion_request_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const rows = await prisma.crmConversionRequest.findMany({});
  return {
    ok: true,
    requests: rows.map(serializeConversionRequest),
    domain: getConversionDomainContract(),
  };
}

export { loadRequest as loadConversionRequest };
