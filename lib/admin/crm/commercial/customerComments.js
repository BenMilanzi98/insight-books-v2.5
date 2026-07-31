/**
 * Customer comments on commercial review — Phase 15 Wave 3.
 */

import { getCommercialDomainContract } from './catalogue.js';
import { resolveReviewAccessByToken } from './reviewAccess.js';

export function hasCrmCommercialCustomerCommentModel(prisma) {
  return typeof prisma?.crmCommercialCustomerComment?.create === 'function';
}

export async function submitCustomerComment(prisma, args = {}) {
  if (!hasCrmCommercialCustomerCommentModel(prisma)) {
    return {
      ok: false,
      error: 'crm_commercial_customer_comment_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const body = args.body != null ? String(args.body).trim() : '';
  if (!body) return { ok: false, error: 'comment_body_required' };

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
    return { ok: false, error: `version_not_commentable:${version.status}` };
  }

  const row = await prisma.crmCommercialCustomerComment.create({
    data: {
      documentVersionId,
      reviewAccessId,
      recipientId,
      body: body.slice(0, 5000),
      createdAt: now,
      updatedAt: now,
    },
  });

  if (['ISSUED', 'DELIVERED', 'VIEWED'].includes(version.status)) {
    await prisma.crmCommercialDocumentVersion.update({
      where: { id: documentVersionId },
      data: { status: 'CUSTOMER_REVIEW', immutable: true, updatedAt: now },
    });
  }

  return {
    ok: true,
    comment: {
      id: row.id,
      documentVersionId: row.documentVersionId,
      body: row.body,
      createdAt: new Date(row.createdAt).toISOString(),
    },
    domain: getCommercialDomainContract(),
  };
}
