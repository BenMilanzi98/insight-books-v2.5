/**
 * Commercial document rejection — Phase 15 Wave 3.
 * Idempotent; binds version + artifact + checksum + recipient.
 * Token path resolves review access (rejects unknown/expired/revoked).
 */

import {
  CRM_COMMERCIAL_DOCUMENT_STATUS,
  getCommercialDomainContract,
} from './catalogue.js';
import { loadArtifactChecksum } from './artifacts.js';
import { resolveReviewAccessByToken } from './reviewAccess.js';

export function hasCrmCommercialRejectionModel(prisma) {
  return typeof prisma?.crmCommercialRejection?.create === 'function';
}

export function serializeRejection(row) {
  if (!row) return null;
  return {
    id: row.id,
    documentVersionId: row.documentVersionId,
    artifactId: row.artifactId,
    checksumSha256: row.checksumSha256,
    recipientId: row.recipientId,
    reason: row.reason || null,
    rejectedAt: row.rejectedAt ? new Date(row.rejectedAt).toISOString() : null,
    idempotencyKey: row.idempotencyKey || null,
  };
}

const REJECTABLE = new Set([
  CRM_COMMERCIAL_DOCUMENT_STATUS.ISSUED,
  CRM_COMMERCIAL_DOCUMENT_STATUS.DELIVERED,
  CRM_COMMERCIAL_DOCUMENT_STATUS.VIEWED,
  CRM_COMMERCIAL_DOCUMENT_STATUS.CUSTOMER_REVIEW,
]);

export async function rejectCommercialDocument(prisma, args = {}) {
  if (!hasCrmCommercialRejectionModel(prisma)) {
    return {
      ok: false,
      error: 'crm_commercial_rejection_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const now = args.now || new Date();
  let documentVersionId = args.documentVersionId || args.commercialDocumentVersionId || null;
  let artifactId = args.artifactId || null;
  let checksumSha256 = args.checksumSha256
    ? String(args.checksumSha256).trim().toLowerCase()
    : '';
  let recipientId = args.recipientId || null;

  if (args.token) {
    const resolved = await resolveReviewAccessByToken(prisma, args.token, { now });
    if (!resolved.ok) return resolved;
    const access = resolved.reviewAccess;
    if (documentVersionId && documentVersionId !== access.documentVersionId) {
      return { ok: false, error: 'document_version_token_mismatch' };
    }
    if (recipientId && access.recipientId && recipientId !== access.recipientId) {
      return { ok: false, error: 'recipient_token_mismatch' };
    }
    if (artifactId && access.artifactId && artifactId !== access.artifactId) {
      return { ok: false, error: 'artifact_token_mismatch' };
    }
    if (
      checksumSha256 &&
      access.checksumSha256 &&
      checksumSha256 !== String(access.checksumSha256).trim().toLowerCase()
    ) {
      return { ok: false, error: 'checksum_token_mismatch' };
    }
    documentVersionId = access.documentVersionId;
    recipientId = access.recipientId;
    artifactId = access.artifactId || artifactId;
    checksumSha256 = access.checksumSha256
      ? String(access.checksumSha256).trim().toLowerCase()
      : checksumSha256;
  }

  if (!documentVersionId) return { ok: false, error: 'documentVersionId_required' };
  if (!artifactId) return { ok: false, error: 'artifactId_required' };
  if (!checksumSha256) return { ok: false, error: 'checksum_required' };
  if (!recipientId) return { ok: false, error: 'recipientId_required' };

  const idempotencyKey = args.idempotencyKey ? String(args.idempotencyKey).trim() : '';
  if (idempotencyKey) {
    const existing = await prisma.crmCommercialRejection.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return {
        ok: true,
        alreadyExists: true,
        rejection: serializeRejection(existing),
        domain: getCommercialDomainContract(),
      };
    }
  }

  const version = await prisma.crmCommercialDocumentVersion.findUnique({
    where: { id: documentVersionId },
  });
  if (!version) return { ok: false, error: 'document_version_not_found' };
  if (version.status === CRM_COMMERCIAL_DOCUMENT_STATUS.SUPERSEDED) {
    return { ok: false, error: 'version_superseded' };
  }
  if (!REJECTABLE.has(version.status) && version.status !== CRM_COMMERCIAL_DOCUMENT_STATUS.REJECTED) {
    return { ok: false, error: `version_not_rejectable:${version.status}` };
  }

  // Active review access required when model present (revoked/expired fail closed)
  if (typeof prisma.crmCommercialReviewAccess?.findFirst === 'function') {
    const access = await prisma.crmCommercialReviewAccess.findFirst({
      where: {
        documentVersionId,
        recipientId,
        revokedAt: null,
      },
    });
    if (!access) {
      return { ok: false, error: 'review_access_revoked' };
    }
    if (access.expiresAt && new Date(access.expiresAt) < now) {
      return { ok: false, error: 'review_access_expired' };
    }
  }

  const stored = await loadArtifactChecksum(prisma, artifactId);
  if (!stored?.sha256 || String(stored.sha256).toLowerCase() !== checksumSha256) {
    return { ok: false, error: 'checksum_mismatch' };
  }

  const row = await prisma.crmCommercialRejection.create({
    data: {
      documentVersionId,
      artifactId,
      checksumSha256,
      recipientId,
      reason: args.reason != null ? String(args.reason).trim().slice(0, 2000) : null,
      rejectedAt: now,
      idempotencyKey: idempotencyKey || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  await prisma.crmCommercialDocumentVersion.update({
    where: { id: documentVersionId },
    data: {
      status: CRM_COMMERCIAL_DOCUMENT_STATUS.REJECTED,
      immutable: true,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    rejection: serializeRejection(row),
    domain: getCommercialDomainContract(),
  };
}
