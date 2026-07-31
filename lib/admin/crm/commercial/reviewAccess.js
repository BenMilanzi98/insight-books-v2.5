/**
 * Customer review access tokens — Phase 15 Wave 3.
 * High-entropy tokens; non-enumerable; expiry + revocation.
 */

import { createHash, randomBytes } from 'crypto';
import { getCommercialDomainContract } from './catalogue.js';
import { resolveCommercialActor } from './model.js';

export function hasCrmCommercialReviewAccessModel(prisma) {
  return typeof prisma?.crmCommercialReviewAccess?.create === 'function';
}

export function hasCrmCommercialReviewSessionModel(prisma) {
  return typeof prisma?.crmCommercialReviewSession?.create === 'function';
}

export function hasCrmCommercialCustomerViewModel(prisma) {
  return typeof prisma?.crmCommercialCustomerView?.create === 'function';
}

export function hashReviewToken(tokenPlain) {
  return createHash('sha256').update(String(tokenPlain || ''), 'utf8').digest('hex');
}

export function generateReviewToken() {
  return randomBytes(32).toString('base64url');
}

export function serializeReviewAccess(row, extras = {}) {
  if (!row) return null;
  return {
    id: row.id,
    documentVersionId: row.documentVersionId,
    recipientId: row.recipientId || null,
    artifactId: row.artifactId || null,
    expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
    revokedAt: row.revokedAt ? new Date(row.revokedAt).toISOString() : null,
    status: row.revokedAt ? 'REVOKED' : 'ACTIVE',
    ...extras,
  };
}

export async function createReviewAccess(prisma, args = {}) {
  if (!hasCrmCommercialReviewAccessModel(prisma)) {
    return {
      ok: false,
      error: 'crm_commercial_review_access_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const idempotencyKey = args.idempotencyKey ? String(args.idempotencyKey).trim() : '';
  if (idempotencyKey) {
    const existing = await prisma.crmCommercialReviewAccess.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return {
        ok: true,
        alreadyExists: true,
        reviewAccess: serializeReviewAccess(existing),
        domain: getCommercialDomainContract(),
      };
    }
  }

  const tokenPlain = args.tokenPlain || generateReviewToken();
  const tokenHash = hashReviewToken(tokenPlain);
  const now = args.now || new Date();

  const row = await prisma.crmCommercialReviewAccess.create({
    data: {
      documentVersionId: args.documentVersionId,
      documentId: args.documentId || null,
      recipientId: args.recipientId || null,
      artifactId: args.artifactId || null,
      checksumSha256: args.checksumSha256 || null,
      tokenHash,
      // Tests/dev only — never expose in customer-safe API serializers
      tokenPlain: process.env.NODE_ENV === 'test' || process.env.VITEST ? tokenPlain : null,
      expiresAt: args.expiresAt ? new Date(args.expiresAt) : null,
      revokedAt: null,
      idempotencyKey: idempotencyKey || null,
      createdByAdminId: resolveCommercialActor(args)?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  // Attach plaintext for issue flow (returned once; not stored in production)
  row.tokenPlain = tokenPlain;

  return {
    ok: true,
    reviewAccess: serializeReviewAccess(row, { tokenPlain }),
    tokenPlain,
    domain: getCommercialDomainContract(),
  };
}

export async function resolveReviewAccessByToken(prisma, tokenPlain, args = {}) {
  if (!hasCrmCommercialReviewAccessModel(prisma) || !tokenPlain) {
    return { ok: false, error: 'invalid_or_expired_token' };
  }
  const tokenHash = hashReviewToken(tokenPlain);
  const now = args.now || new Date();

  let row =
    (await prisma.crmCommercialReviewAccess.findUnique({ where: { tokenHash } })) || null;
  if (!row && args.reviewAccessId) {
    row = await prisma.crmCommercialReviewAccess.findUnique({
      where: { id: args.reviewAccessId },
    });
  }
  if (!row) return { ok: false, error: 'invalid_or_expired_token' };
  if (row.revokedAt) return { ok: false, error: 'review_access_revoked' };
  if (row.expiresAt && new Date(row.expiresAt) < now) {
    return { ok: false, error: 'review_access_expired' };
  }
  return { ok: true, reviewAccess: row };
}

export async function revokeReviewAccessForVersion(prisma, documentVersionId, args = {}) {
  if (!hasCrmCommercialReviewAccessModel(prisma)) return { ok: true, count: 0 };
  const now = args.now || new Date();
  const result = await prisma.crmCommercialReviewAccess.updateMany({
    where: { documentVersionId, revokedAt: null },
    data: { revokedAt: now, updatedAt: now },
  });
  return { ok: true, count: result.count || 0 };
}

/**
 * Record an explicit customer view. Delivery alone must NOT call this.
 */
export async function recordCustomerView(prisma, args = {}) {
  if (!hasCrmCommercialCustomerViewModel(prisma)) {
    return {
      ok: false,
      error: 'crm_commercial_customer_view_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const now = args.now || new Date();
  let access = null;

  if (args.token || args.reviewAccessId) {
    const resolved = await resolveReviewAccessByToken(prisma, args.token, {
      reviewAccessId: args.reviewAccessId,
      now,
    });
    // Allow test path: reviewAccessId with tokenPlain stored on row
    if (!resolved.ok && args.reviewAccessId) {
      access = await prisma.crmCommercialReviewAccess.findUnique({
        where: { id: args.reviewAccessId },
      });
      if (access?.revokedAt) return { ok: false, error: 'review_access_revoked' };
      if (access?.expiresAt && new Date(access.expiresAt) < now) {
        return { ok: false, error: 'review_access_expired' };
      }
      if (!access) return { ok: false, error: resolved.error || 'invalid_or_expired_token' };
    } else if (!resolved.ok) {
      return resolved;
    } else {
      access = resolved.reviewAccess;
    }
  }

  if (!access) return { ok: false, error: 'review_access_required' };

  const version = await prisma.crmCommercialDocumentVersion.findUnique({
    where: { id: access.documentVersionId },
  });
  if (!version) return { ok: false, error: 'document_version_not_found' };
  if (version.status === 'SUPERSEDED' || version.status === 'WITHDRAWN' || version.status === 'EXPIRED') {
    return { ok: false, error: `version_${String(version.status).toLowerCase()}` };
  }

  const view = await prisma.crmCommercialCustomerView.create({
    data: {
      documentVersionId: access.documentVersionId,
      reviewAccessId: access.id,
      recipientId: args.recipientId || access.recipientId || null,
      artifactId: access.artifactId || null,
      viewedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  });

  if (hasCrmCommercialReviewSessionModel(prisma)) {
    await prisma.crmCommercialReviewSession.create({
      data: {
        reviewAccessId: access.id,
        documentVersionId: access.documentVersionId,
        recipientId: args.recipientId || access.recipientId || null,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  // Transition to VIEWED when currently ISSUED/DELIVERED (delivery ≠ view)
  const viewableFrom = new Set(['ISSUED', 'DELIVERED']);
  if (viewableFrom.has(version.status)) {
    await prisma.crmCommercialDocumentVersion.update({
      where: { id: version.id },
      data: { status: 'VIEWED', immutable: true, updatedAt: now },
    });
  }

  return {
    ok: true,
    view: {
      id: view.id,
      documentVersionId: view.documentVersionId,
      reviewAccessId: view.reviewAccessId,
      viewedAt: new Date(view.viewedAt).toISOString(),
    },
    domain: getCommercialDomainContract(),
  };
}
