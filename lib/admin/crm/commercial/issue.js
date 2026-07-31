/**
 * Issue commercial document — Phase 15 Wave 3.
 * Issue binds artifact + recipients + delivery; idempotent by key.
 * Supersedes prior issued versions on the same document.
 */

import { resolveCrmAccess } from '../authz.js';
import {
  CRM_COMMERCIAL_DOCUMENT_STATUS,
  getCommercialDomainContract,
} from './catalogue.js';
import { CRM_DELIVERY_METHOD, recordCommercialDelivery } from './delivery.js';
import { canEditCommercial, loadCommercialDocument } from './documents.js';
import { loadArtifactChecksum } from './artifacts.js';
import { resolveCommercialActor } from './model.js';
import { createReviewAccess, revokeReviewAccessForVersion } from './reviewAccess.js';
import { loadDocumentVersion } from './versions.js';

export function hasCrmCommercialIssueIdempotency(prisma) {
  return typeof prisma?.crmCommercialDelivery?.findUnique === 'function';
}

async function supersedePriorVersions(prisma, documentId, keepVersionId, now) {
  const priorStatuses = [
    CRM_COMMERCIAL_DOCUMENT_STATUS.ISSUED,
    CRM_COMMERCIAL_DOCUMENT_STATUS.DELIVERED,
    CRM_COMMERCIAL_DOCUMENT_STATUS.VIEWED,
    CRM_COMMERCIAL_DOCUMENT_STATUS.CUSTOMER_REVIEW,
    CRM_COMMERCIAL_DOCUMENT_STATUS.REVISION_REQUESTED,
  ];

  const priors = await prisma.crmCommercialDocumentVersion.findMany({
    where: {
      documentId,
      status: { in: priorStatuses },
    },
  });

  for (const prior of priors) {
    if (prior.id === keepVersionId) continue;
    await prisma.crmCommercialDocumentVersion.update({
      where: { id: prior.id },
      data: {
        status: CRM_COMMERCIAL_DOCUMENT_STATUS.SUPERSEDED,
        immutable: true,
        updatedAt: now,
      },
    });
    await revokeReviewAccessForVersion(prisma, prior.id, { now });
    if (typeof prisma.crmCommercialDocumentVersionStatusHistory?.create === 'function') {
      await prisma.crmCommercialDocumentVersionStatusHistory.create({
        data: {
          versionId: prior.id,
          fromStatus: prior.status,
          toStatus: CRM_COMMERCIAL_DOCUMENT_STATUS.SUPERSEDED,
          reason: 'superseded_by_new_issue',
          at: now,
        },
      });
    }
  }
}

/**
 * Issue a commercial document version with checksummed artifact + delivery.
 */
export async function issueCommercialDocument(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!canEditCommercial(access)) {
    return { ok: false, forbidden: true, reason: 'crm_commercial_issue_forbidden' };
  }

  const versionId =
    args.commercialDocumentVersionId || args.documentVersionId || args.versionId;
  if (!versionId) return { ok: false, error: 'commercialDocumentVersionId_required' };
  if (!args.artifactId) return { ok: false, error: 'artifactId_required' };

  const idempotencyKey = args.idempotencyKey ? String(args.idempotencyKey).trim() : '';
  if (idempotencyKey && typeof prisma.crmCommercialDelivery?.findUnique === 'function') {
    const existing = await prisma.crmCommercialDelivery.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return {
        ok: true,
        alreadyExists: true,
        delivery: {
          id: existing.id,
          documentVersionId: existing.documentVersionId,
          method: existing.method || existing.deliveryMethod,
        },
        issue: { id: existing.id, idempotencyKey },
        domain: getCommercialDomainContract(),
      };
    }
  }

  const version = await loadDocumentVersion(prisma, versionId);
  if (!version) return { ok: false, error: 'document_version_not_found', notFound: true };

  const issuable = new Set([
    CRM_COMMERCIAL_DOCUMENT_STATUS.READY_TO_ISSUE,
    CRM_COMMERCIAL_DOCUMENT_STATUS.APPROVED,
    CRM_COMMERCIAL_DOCUMENT_STATUS.ISSUED,
  ]);
  // Allow re-issue of same version only via idempotency; new issue of READY/APPROVED/ISSUED
  if (
    version.status === CRM_COMMERCIAL_DOCUMENT_STATUS.SUPERSEDED ||
    version.status === CRM_COMMERCIAL_DOCUMENT_STATUS.WITHDRAWN ||
    version.status === CRM_COMMERCIAL_DOCUMENT_STATUS.EXPIRED ||
    version.status === CRM_COMMERCIAL_DOCUMENT_STATUS.ACCEPTED ||
    version.status === CRM_COMMERCIAL_DOCUMENT_STATUS.REJECTED
  ) {
    return { ok: false, error: `version_not_issuable:${version.status}` };
  }

  const artifact = await prisma.crmCommercialArtifact.findUnique({
    where: { id: args.artifactId },
  });
  if (!artifact) return { ok: false, error: 'artifact_not_found' };
  if (
    (artifact.versionId || artifact.documentVersionId) !== versionId ||
    artifact.projection !== 'ISSUED'
  ) {
    return { ok: false, error: 'artifact_version_projection_mismatch' };
  }

  const checksum = await loadArtifactChecksum(prisma, artifact.id);
  if (!checksum?.sha256) return { ok: false, error: 'artifact_checksum_missing' };

  const document = await loadCommercialDocument(prisma, version.documentId);
  const now = args.now || new Date();
  const method = String(args.deliveryMethod || CRM_DELIVERY_METHOD.SECURE_LINK)
    .trim()
    .toUpperCase();
  const recipientIds = Array.isArray(args.recipientIds)
    ? args.recipientIds.map((id) => String(id))
    : [];
  if (!recipientIds.length) return { ok: false, error: 'recipientIds_required' };

  // Supersede prior issued/delivered versions before marking this one issued
  if (version.documentId) {
    await supersedePriorVersions(prisma, version.documentId, versionId, now);
  }

  // Transition to ISSUED if not already past issue
  if (
    version.status === CRM_COMMERCIAL_DOCUMENT_STATUS.READY_TO_ISSUE ||
    version.status === CRM_COMMERCIAL_DOCUMENT_STATUS.APPROVED ||
    issuable.has(version.status)
  ) {
    if (version.status !== CRM_COMMERCIAL_DOCUMENT_STATUS.ISSUED) {
      await prisma.crmCommercialDocumentVersion.update({
        where: { id: versionId },
        data: {
          status: CRM_COMMERCIAL_DOCUMENT_STATUS.ISSUED,
          immutable: true,
          updatedAt: now,
        },
      });
      if (typeof prisma.crmCommercialDocumentVersionStatusHistory?.create === 'function') {
        await prisma.crmCommercialDocumentVersionStatusHistory.create({
          data: {
            versionId,
            fromStatus: version.status,
            toStatus: CRM_COMMERCIAL_DOCUMENT_STATUS.ISSUED,
            reason: args.reason || 'issued',
            changedByAdminId: admin?.id || null,
            at: now,
          },
        });
      }
    }
  }

  // Then mark DELIVERED after delivery records (delivery ≠ view)
  const deliveries = [];
  const reviewAccesses = [];

  for (const recipientId of recipientIds) {
    const accessResult = await createReviewAccess(prisma, {
      actorContext: args.actorContext || { admin },
      documentVersionId: versionId,
      documentId: version.documentId,
      recipientId,
      artifactId: artifact.id,
      checksumSha256: checksum.sha256,
      expiresAt: args.validUntil || null,
      idempotencyKey: idempotencyKey
        ? `${idempotencyKey}:access:${recipientId}`
        : undefined,
      now,
    });
    if (!accessResult.ok && !accessResult.alreadyExists) {
      return accessResult;
    }
    reviewAccesses.push(accessResult.reviewAccess);

    const del = await recordCommercialDelivery(prisma, {
      actorContext: args.actorContext || { admin },
      documentVersionId: versionId,
      documentId: version.documentId,
      opportunityId: document?.opportunityId,
      accountId: document?.accountId,
      recipientId,
      artifactId: artifact.id,
      reviewAccessId: accessResult.reviewAccess?.id,
      deliveryMethod: method,
      validUntil: args.validUntil,
      evidenceJson: args.evidenceJson || null,
      // Primary idempotency on first recipient only; others keyed uniquely
      idempotencyKey:
        recipientId === recipientIds[0] && idempotencyKey
          ? idempotencyKey
          : idempotencyKey
            ? `${idempotencyKey}:del:${recipientId}`
            : undefined,
      now,
    });
    if (!del.ok && !del.alreadyExists) return del;
    deliveries.push(del.delivery);
  }

  await prisma.crmCommercialDocumentVersion.update({
    where: { id: versionId },
    data: {
      status: CRM_COMMERCIAL_DOCUMENT_STATUS.DELIVERED,
      immutable: true,
      updatedAt: now,
    },
  });

  if (document && typeof prisma.crmCommercialDocument?.update === 'function') {
    await prisma.crmCommercialDocument.update({
      where: { id: document.id },
      data: {
        currentVersionId: versionId,
        updatedAt: now,
      },
    });
  }

  // Persist validUntil on primary delivery for expiry job
  if (args.validUntil && deliveries[0]?.id) {
    try {
      await prisma.crmCommercialDelivery.update({
        where: { id: deliveries[0].id },
        data: { validUntil: new Date(args.validUntil), updatedAt: now },
      });
    } catch {
      // optional column
    }
  }

  return {
    ok: true,
    issue: {
      id: deliveries[0]?.id,
      documentVersionId: versionId,
      artifactId: artifact.id,
      checksumSha256: checksum.sha256,
      idempotencyKey: idempotencyKey || null,
      validUntil: args.validUntil || null,
    },
    delivery: deliveries[0],
    deliveries,
    reviewAccesses,
    domain: getCommercialDomainContract(),
  };
}

/**
 * Withdraw an issued version and revoke review links.
 */
export async function withdrawCommercialDocument(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!canEditCommercial(access)) {
    return { ok: false, forbidden: true, reason: 'crm_commercial_withdraw_forbidden' };
  }
  const versionId = args.documentVersionId || args.commercialDocumentVersionId;
  const version = await loadDocumentVersion(prisma, versionId);
  if (!version) return { ok: false, error: 'document_version_not_found' };

  const now = args.now || new Date();
  await prisma.crmCommercialDocumentVersion.update({
    where: { id: versionId },
    data: {
      status: CRM_COMMERCIAL_DOCUMENT_STATUS.WITHDRAWN,
      immutable: true,
      updatedAt: now,
    },
  });
  await revokeReviewAccessForVersion(prisma, versionId, { now });

  return {
    ok: true,
    versionId,
    status: CRM_COMMERCIAL_DOCUMENT_STATUS.WITHDRAWN,
    domain: getCommercialDomainContract(),
  };
}
