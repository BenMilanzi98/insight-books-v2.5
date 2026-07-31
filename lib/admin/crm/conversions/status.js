/**
 * Conversion request / conversion status transitions — Phase 16 Wave 1.
 */

import {
  CRM_CONVERSION_REQUEST_STATUS,
  CRM_CONVERSION_STATUS,
  getConversionDomainContract,
} from './catalogue.js';
import {
  hasCrmConversionRequestStatusHistoryModel,
  hasCrmConversionStatusHistoryModel,
  resolveConversionActor,
  serializeConversion,
  serializeConversionRequest,
} from './model.js';

const REQUEST_TRANSITIONS = Object.freeze({
  [CRM_CONVERSION_REQUEST_STATUS.DRAFT]: [
    CRM_CONVERSION_REQUEST_STATUS.VALIDATING,
    CRM_CONVERSION_REQUEST_STATUS.READY,
    CRM_CONVERSION_REQUEST_STATUS.CANCELLED,
  ],
  [CRM_CONVERSION_REQUEST_STATUS.VALIDATING]: [
    CRM_CONVERSION_REQUEST_STATUS.INFORMATION_REQUIRED,
    CRM_CONVERSION_REQUEST_STATUS.READY,
    CRM_CONVERSION_REQUEST_STATUS.BLOCKED,
    CRM_CONVERSION_REQUEST_STATUS.CANCELLED,
  ],
  [CRM_CONVERSION_REQUEST_STATUS.INFORMATION_REQUIRED]: [
    CRM_CONVERSION_REQUEST_STATUS.VALIDATING,
    CRM_CONVERSION_REQUEST_STATUS.READY,
    CRM_CONVERSION_REQUEST_STATUS.CANCELLED,
  ],
  [CRM_CONVERSION_REQUEST_STATUS.READY]: [
    CRM_CONVERSION_REQUEST_STATUS.QUEUED,
    CRM_CONVERSION_REQUEST_STATUS.IN_PROGRESS,
    CRM_CONVERSION_REQUEST_STATUS.CANCELLED,
  ],
  [CRM_CONVERSION_REQUEST_STATUS.QUEUED]: [
    CRM_CONVERSION_REQUEST_STATUS.IN_PROGRESS,
    CRM_CONVERSION_REQUEST_STATUS.CANCELLED,
  ],
  [CRM_CONVERSION_REQUEST_STATUS.IN_PROGRESS]: [
    CRM_CONVERSION_REQUEST_STATUS.PARTIALLY_COMPLETED,
    CRM_CONVERSION_REQUEST_STATUS.COMPLETED,
    CRM_CONVERSION_REQUEST_STATUS.FAILED,
    CRM_CONVERSION_REQUEST_STATUS.BLOCKED,
  ],
  [CRM_CONVERSION_REQUEST_STATUS.PARTIALLY_COMPLETED]: [
    CRM_CONVERSION_REQUEST_STATUS.IN_PROGRESS,
    CRM_CONVERSION_REQUEST_STATUS.COMPLETED,
    CRM_CONVERSION_REQUEST_STATUS.FAILED,
  ],
  [CRM_CONVERSION_REQUEST_STATUS.FAILED]: [
    CRM_CONVERSION_REQUEST_STATUS.IN_PROGRESS,
    CRM_CONVERSION_REQUEST_STATUS.ARCHIVED,
  ],
  [CRM_CONVERSION_REQUEST_STATUS.COMPLETED]: [CRM_CONVERSION_REQUEST_STATUS.ARCHIVED],
  [CRM_CONVERSION_REQUEST_STATUS.CANCELLED]: [CRM_CONVERSION_REQUEST_STATUS.ARCHIVED],
  [CRM_CONVERSION_REQUEST_STATUS.ARCHIVED]: [],
});

export function canTransitionConversionRequestStatus(from, to) {
  const allowed = REQUEST_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export async function transitionConversionRequestStatus(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const row = await prisma.crmConversionRequest.findUnique({
    where: { id: args.conversionRequestId || args.requestId },
  });
  if (!row) return { ok: false, notFound: true, error: 'conversion_request_not_found' };

  const toStatus = String(args.toStatus || '')
    .trim()
    .toUpperCase();
  if (row.status === toStatus) {
    return {
      ok: true,
      request: serializeConversionRequest(row),
      alreadyInStatus: true,
      domain: getConversionDomainContract(),
    };
  }
  if (!canTransitionConversionRequestStatus(row.status, toStatus)) {
    return {
      ok: false,
      error: `invalid_status_transition: ${row.status} → ${toStatus}`,
    };
  }

  const now = args.now || new Date();
  const updated = await prisma.crmConversionRequest.update({
    where: { id: row.id },
    data: { status: toStatus, updatedAt: now },
  });

  if (hasCrmConversionRequestStatusHistoryModel(prisma)) {
    await prisma.crmConversionRequestStatusHistory.create({
      data: {
        requestId: row.id,
        fromStatus: row.status,
        toStatus,
        reason: args.reason != null ? String(args.reason).trim().slice(0, 1000) : null,
        changedByAdminId: admin?.id || null,
        at: now,
      },
    });
  }

  return {
    ok: true,
    request: serializeConversionRequest(updated),
    domain: getConversionDomainContract(),
  };
}

export async function transitionConversionStatus(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const row = await prisma.crmConversion.findUnique({
    where: { id: args.conversionId },
  });
  if (!row) return { ok: false, notFound: true, error: 'conversion_not_found' };

  const toStatus = String(args.toStatus || '')
    .trim()
    .toUpperCase();
  if (row.status === toStatus) {
    return {
      ok: true,
      conversion: serializeConversion(row),
      alreadyInStatus: true,
      domain: getConversionDomainContract(),
    };
  }

  const now = args.now || new Date();
  const updated = await prisma.crmConversion.update({
    where: { id: row.id },
    data: { status: toStatus, updatedAt: now },
  });

  if (hasCrmConversionStatusHistoryModel(prisma)) {
    await prisma.crmConversionStatusHistory.create({
      data: {
        conversionId: row.id,
        fromStatus: row.status,
        toStatus,
        reason: args.reason != null ? String(args.reason).trim().slice(0, 1000) : null,
        changedByAdminId: admin?.id || null,
        at: now,
      },
    });
  }

  return {
    ok: true,
    conversion: serializeConversion(updated),
    domain: getConversionDomainContract(),
  };
}

export { CRM_CONVERSION_REQUEST_STATUS, CRM_CONVERSION_STATUS };
