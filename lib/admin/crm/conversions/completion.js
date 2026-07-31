/**
 * Conversion completion certificate + compensation safety — Phase 16 Wave 4.
 * Certificate checksum is deterministic. Compensation never deletes acceptance.
 */

import { createHash } from 'crypto';
import { resolveCrmAccess } from '../authz.js';
import {
  resolveConversionActor,
  hasCrmConversionModel,
  serializeConversion,
} from './model.js';
import { CRM_CONVERSION_STATUS } from './catalogue.js';

export function hasCrmConversionCompletionCertificateModel(prisma) {
  return typeof prisma?.crmConversionCompletionCertificate?.create === 'function';
}

/**
 * Stable certificate checksum from canonical conversion evidence.
 */
export function computeCompletionCertificateChecksum(payload = {}) {
  const canonical = {
    conversionId: payload.conversionId || null,
    acceptanceId: payload.acceptanceId || null,
    documentVersionId: payload.documentVersionId || null,
    acceptanceChecksumSha256: payload.acceptanceChecksumSha256 || null,
    tenantId: payload.tenantId || null,
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function serializeCertificate(row) {
  if (!row) return null;
  return {
    id: row.id,
    conversionId: row.conversionId || null,
    acceptanceId: row.acceptanceId || null,
    documentVersionId: row.documentVersionId || null,
    tenantId: row.tenantId || null,
    checksumSha256: row.checksumSha256 || null,
    status: row.status || 'ISSUED',
    idempotencyKey: row.idempotencyKey || null,
    payloadJson: row.payloadJson ?? null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

async function resolveTenantId(prisma, conversionId) {
  if (typeof prisma.crmConversionResource?.findFirst !== 'function') {
    return null;
  }
  const resource = await prisma.crmConversionResource.findFirst({
    where: { conversionId, resourceType: 'TENANT' },
  });
  return resource?.resourceId || null;
}

/**
 * Finalize conversion with idempotent completion certificate.
 */
export async function finalizeConversion(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const access = resolveCrmAccess(admin);
  if (!access.canEditOpportunities && !access.isSuperAdmin) {
    return { ok: false, forbidden: true, reason: 'crm_finalize_forbidden' };
  }

  if (!hasCrmConversionModel(prisma)) {
    return {
      ok: false,
      error: 'crm_conversion_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }
  if (!hasCrmConversionCompletionCertificateModel(prisma)) {
    return {
      ok: false,
      error: 'crm_conversion_completion_certificate_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const conversionId = args.conversionId ? String(args.conversionId).trim() : '';
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';
  if (!conversionId || !idempotencyKey) {
    return { ok: false, error: 'conversionId_idempotencyKey_required' };
  }

  const existing = await prisma.crmConversionCompletionCertificate.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    return {
      ok: true,
      alreadyExists: true,
      idempotentReplay: true,
      certificate: serializeCertificate(existing),
      created: false,
    };
  }

  const conversion = await prisma.crmConversion.findUnique({
    where: { id: conversionId },
  });
  if (!conversion) {
    return { ok: false, notFound: true, error: 'conversion_not_found' };
  }

  const tenantId =
    args.tenantId ||
    (await resolveTenantId(prisma, conversionId)) ||
    null;

  const canonical = {
    conversionId: conversion.id,
    acceptanceId: conversion.acceptanceId || args.acceptanceId || null,
    documentVersionId:
      conversion.documentVersionId || args.documentVersionId || null,
    acceptanceChecksumSha256:
      conversion.checksumSha256 || args.acceptanceChecksumSha256 || null,
    tenantId,
  };
  const checksumSha256 = computeCompletionCertificateChecksum(canonical);
  const now = args.now || new Date();

  const row = await prisma.crmConversionCompletionCertificate.create({
    data: {
      conversionId: conversion.id,
      acceptanceId: canonical.acceptanceId,
      documentVersionId: canonical.documentVersionId,
      tenantId,
      checksumSha256,
      status: 'ISSUED',
      idempotencyKey,
      payloadJson: {
        ...canonical,
        conversionNumber: conversion.conversionNumber || null,
        note: 'Completion certificate — does not imply PAID/ACTIVE/onboarding complete',
      },
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  if (typeof prisma.crmConversion.update === 'function') {
    try {
      await prisma.crmConversion.update({
        where: { id: conversion.id },
        data: {
          status: CRM_CONVERSION_STATUS.COMPLETED,
          updatedAt: now,
        },
      });
    } catch {
      /* best-effort status bump */
    }
  }

  return {
    ok: true,
    created: true,
    certificate: serializeCertificate(row),
    conversion: serializeConversion({
      ...conversion,
      status: CRM_CONVERSION_STATUS.COMPLETED,
    }),
  };
}

/**
 * Compensation path — may mark handoffs/resources compensated.
 * NEVER deletes commercial acceptance evidence.
 */
export async function compensateConversionArtifacts(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const access = resolveCrmAccess(admin);
  if (!access.canEditOpportunities && !access.isSuperAdmin) {
    return { ok: false, forbidden: true, reason: 'crm_compensate_forbidden' };
  }

  const conversionId = args.conversionId ? String(args.conversionId).trim() : '';
  const acceptanceId = args.acceptanceId ? String(args.acceptanceId).trim() : '';

  // Explicit hard rule: never call delete/deleteMany on acceptance.
  const acceptancePreserved = true;
  const deletedAcceptance = false;

  let acceptanceCount = null;
  if (
    acceptanceId &&
    typeof prisma.crmCommercialAcceptance?.findUnique === 'function'
  ) {
    const acceptance = await prisma.crmCommercialAcceptance.findUnique({
      where: { id: acceptanceId },
    });
    acceptanceCount = acceptance ? 1 : 0;
  }

  if (
    conversionId &&
    typeof prisma.crmConversionDomainHandoff?.findMany === 'function'
  ) {
    try {
      const handoffs = await prisma.crmConversionDomainHandoff.findMany({
        where: { conversionId },
      });
      for (const h of handoffs || []) {
        if (typeof prisma.crmConversionDomainHandoff.update === 'function') {
          await prisma.crmConversionDomainHandoff.update({
            where: { id: h.id },
            data: {
              status: 'CANCELLED',
              updatedAt: args.now || new Date(),
              payloadJson: {
                ...(h.payloadJson && typeof h.payloadJson === 'object'
                  ? h.payloadJson
                  : {}),
                compensated: true,
                compensationReason: args.reason || 'conversion_compensation',
                acceptancePreserved: true,
              },
            },
          });
        }
      }
    } catch {
      /* best-effort */
    }
  }

  return {
    ok: true,
    acceptancePreserved,
    deletedAcceptance,
    acceptanceId: acceptanceId || null,
    acceptanceStillPresent: acceptanceCount === 1,
    conversionId: conversionId || null,
    meta: {
      neverDeleteAcceptance: true,
      neverDeletePaidEvidence: true,
      reason: args.reason || null,
    },
  };
}
