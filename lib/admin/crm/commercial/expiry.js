/**
 * Commercial document expiry job — Phase 15 Wave 3.
 * Idempotent: double-run with same key expires once.
 */

import {
  CRM_COMMERCIAL_DOCUMENT_STATUS,
  getCommercialDomainContract,
} from './catalogue.js';
import { revokeReviewAccessForVersion } from './reviewAccess.js';

export function hasCrmCommercialExpiryModel(prisma) {
  return typeof prisma?.crmCommercialExpiry?.create === 'function';
}

const EXPIREABLE = new Set([
  CRM_COMMERCIAL_DOCUMENT_STATUS.ISSUED,
  CRM_COMMERCIAL_DOCUMENT_STATUS.DELIVERED,
  CRM_COMMERCIAL_DOCUMENT_STATUS.VIEWED,
  CRM_COMMERCIAL_DOCUMENT_STATUS.CUSTOMER_REVIEW,
  CRM_COMMERCIAL_DOCUMENT_STATUS.CUSTOMER_DEFERRED,
]);

/**
 * Expire versions whose issue validUntil has passed.
 */
export async function runCommercialExpiryJob(prisma, args = {}) {
  if (!hasCrmCommercialExpiryModel(prisma)) {
    return {
      ok: false,
      error: 'crm_commercial_expiry_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const now = args.now || new Date();
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : `expiry:${now.toISOString().slice(0, 13)}`;

  const existingJob = await prisma.crmCommercialExpiry.findUnique({
    where: { idempotencyKey },
  });
  if (existingJob) {
    return {
      ok: true,
      alreadyRan: true,
      idempotent: true,
      expiredCount: existingJob.expiredCount ?? 0,
      expiry: existingJob,
      domain: getCommercialDomainContract(),
    };
  }

  // Find deliveries past validUntil still on expireable versions
  let candidates = [];
  if (typeof prisma.crmCommercialDelivery?.findMany === 'function') {
    const deliveries = await prisma.crmCommercialDelivery.findMany({
      where: {
        validUntil: { lte: now },
      },
    });
    candidates = deliveries;
  }

  const expiredVersionIds = new Set();
  for (const del of candidates) {
    const versionId = del.documentVersionId;
    if (!versionId || expiredVersionIds.has(versionId)) continue;
    const version = await prisma.crmCommercialDocumentVersion.findUnique({
      where: { id: versionId },
    });
    if (!version || !EXPIREABLE.has(version.status)) continue;

    await prisma.crmCommercialDocumentVersion.update({
      where: { id: versionId },
      data: {
        status: CRM_COMMERCIAL_DOCUMENT_STATUS.EXPIRED,
        immutable: true,
        updatedAt: now,
      },
    });
    await revokeReviewAccessForVersion(prisma, versionId, { now });
    expiredVersionIds.add(versionId);
  }

  const row = await prisma.crmCommercialExpiry.create({
    data: {
      idempotencyKey,
      expiredCount: expiredVersionIds.size,
      ranAt: now,
      payloadJson: { versionIds: [...expiredVersionIds] },
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    expiredCount: expiredVersionIds.size,
    expiry: row,
    domain: getCommercialDomainContract(),
  };
}
