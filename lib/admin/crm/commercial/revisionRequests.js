/**
 * Customer revision requests — Phase 15 Wave 3.
 */

import {
  CRM_COMMERCIAL_DOCUMENT_STATUS,
  getCommercialDomainContract,
} from './catalogue.js';
import { resolveReviewAccessByToken } from './reviewAccess.js';

export function hasCrmCommercialRevisionRequestModel(prisma) {
  return typeof prisma?.crmCommercialRevisionRequest?.create === 'function';
}

export async function submitRevisionRequest(prisma, args = {}) {
  if (!hasCrmCommercialRevisionRequestModel(prisma)) {
    return {
      ok: false,
      error: 'crm_commercial_revision_request_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const reason = args.reason != null ? String(args.reason).trim() : '';
  if (!reason) return { ok: false, error: 'revision_reason_required' };

  const now = args.now || new Date();
  let documentVersionId = args.documentVersionId || null;
  let reviewAccessId = args.reviewAccessId || null;
  let recipientId = args.recipientId || null;

  if (args.token) {
    const resolved = await resolveReviewAccessByToken(prisma, args.token, { now });
    if (!resolved.ok) return resolved;
    documentVersionId = resolved.reviewAccess.documentVersionId;
    reviewAccessId = resolved.reviewAccess.id;
    recipientId = recipientId || resolved.reviewAccess.recipientId;
  }

  if (!documentVersionId) return { ok: false, error: 'documentVersionId_required' };

  const version = await prisma.crmCommercialDocumentVersion.findUnique({
    where: { id: documentVersionId },
  });
  if (!version) return { ok: false, error: 'document_version_not_found' };
  if (['SUPERSEDED', 'WITHDRAWN', 'EXPIRED', 'ACCEPTED', 'REJECTED'].includes(version.status)) {
    return { ok: false, error: `version_not_revisable:${version.status}` };
  }

  const idempotencyKey = args.idempotencyKey ? String(args.idempotencyKey).trim() : '';
  if (idempotencyKey) {
    const existing = await prisma.crmCommercialRevisionRequest.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return {
        ok: true,
        alreadyExists: true,
        revisionRequest: existing,
        domain: getCommercialDomainContract(),
      };
    }
  }

  const row = await prisma.crmCommercialRevisionRequest.create({
    data: {
      documentVersionId,
      reviewAccessId,
      recipientId,
      reason: reason.slice(0, 5000),
      detailsJson: args.detailsJson ?? null,
      status: 'OPEN',
      idempotencyKey: idempotencyKey || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  await prisma.crmCommercialDocumentVersion.update({
    where: { id: documentVersionId },
    data: {
      status: CRM_COMMERCIAL_DOCUMENT_STATUS.REVISION_REQUESTED,
      immutable: true,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    revisionRequest: {
      id: row.id,
      documentVersionId: row.documentVersionId,
      reason: row.reason,
      status: row.status,
      createdAt: new Date(row.createdAt).toISOString(),
    },
    domain: getCommercialDomainContract(),
  };
}
