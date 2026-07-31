/**
 * Initial User invitations — Phase 16 Wave 2.
 * Hash-only tokens; no default/shared passwords; exact retry → same invite.
 * Never grants Platform Super Admin. Never stores raw tokens.
 */

import { createHash, randomBytes } from 'crypto';
import { CRM_CONVERSION_RESOURCE_TYPE } from './catalogue.js';
import { assertTenantIsolation } from './isolation.js';
import { resolveConversionActor } from './model.js';

const DEFAULT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(raw) {
  return createHash('sha256').update(String(raw)).digest('hex');
}

function hasInviteModel(prisma) {
  return typeof prisma?.crmConversionInvitation?.create === 'function';
}

function hasResourceModel(prisma) {
  return typeof prisma?.crmConversionResource?.create === 'function';
}

/**
 * Create initial user invitation (hash-only). Exact idempotencyKey retry returns same invite.
 */
export async function createInitialUserInvitation(prisma, args = {}) {
  const admin = resolveConversionActor(args);
  const conversionId = args.conversionId ? String(args.conversionId) : null;
  const tenantId = args.tenantId ? String(args.tenantId) : null;
  const email = args.email ? String(args.email).trim().toLowerCase() : null;
  const contactId = args.contactId || null;
  const idempotencyKey =
    args.idempotencyKey ||
    (conversionId && contactId
      ? `invite:${conversionId}:${contactId}`
      : conversionId && email
        ? `invite:${conversionId}:${email}`
        : null);

  if (!tenantId) {
    return { ok: false, error: 'tenantId_required', status: 'NOT_AVAILABLE' };
  }
  if (!email) {
    return { ok: false, error: 'email_required', status: 'NOT_AVAILABLE' };
  }
  if (!idempotencyKey) {
    return { ok: false, error: 'idempotencyKey_required' };
  }

  const isolation = assertTenantIsolation({
    lockedTenantId: tenantId,
    requestedTenantId: tenantId,
    resource: 'USER_INVITATION',
  });
  if (!isolation.ok) {
    return { ok: false, error: isolation.error };
  }

  if (!hasInviteModel(prisma)) {
    return {
      ok: false,
      error: 'invitation_model_unavailable',
      status: 'NOT_AVAILABLE',
    };
  }

  const existing = await prisma.crmConversionInvitation.findFirst({
    where: { conversionId, idempotencyKey },
  });
  if (existing) {
    return {
      ok: true,
      invitationId: existing.id,
      tokenHash: existing.tokenHash,
      idempotentReplay: true,
      status: existing.status || 'PENDING',
      expiresAt: existing.expiresAt || null,
    };
  }

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const now = args.now || new Date();
  const expiresAt = args.expiresAt || new Date(now.getTime() + DEFAULT_EXPIRY_MS);

  // Persist hash only — never raw token / password fields
  const invite = await prisma.crmConversionInvitation.create({
    data: {
      conversionId,
      tenantId,
      contactId,
      email,
      tokenHash,
      status: 'PENDING',
      expiresAt,
      idempotencyKey,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  if (hasResourceModel(prisma) && conversionId) {
    await prisma.crmConversionResource.create({
      data: {
        conversionId,
        resourceType: CRM_CONVERSION_RESOURCE_TYPE.USER_INVITATION,
        resourceId: invite.id,
        action: 'CREATE',
        status: 'PENDING',
        idempotencyKey,
        metaJson: { tenantId, contactId, email },
        actorAdminId: admin?.id || null,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  // Raw token is intentionally not returned on durable create for conversion
  // (delivery channel may obtain one-time plaintext via separate send helper later).
  return {
    ok: true,
    invitationId: invite.id,
    tokenHash,
    status: 'PENDING',
    expiresAt,
    idempotentReplay: false,
  };
}

/**
 * Revoke a pending invitation (compensation-friendly).
 */
export async function revokeConversionInvitation(prisma, args = {}) {
  if (!hasInviteModel(prisma) || typeof prisma.crmConversionInvitation.update !== 'function') {
    return { ok: false, error: 'invitation_model_unavailable', status: 'NOT_AVAILABLE' };
  }
  const id = args.invitationId;
  if (!id) return { ok: false, error: 'invitationId_required' };
  // Soft-status update if update available on mock/real
  try {
    const updated = await prisma.crmConversionInvitation.update({
      where: { id },
      data: { status: 'REVOKED', updatedAt: args.now || new Date() },
    });
    return { ok: true, invitation: updated };
  } catch (err) {
    return { ok: false, error: err?.message || 'revoke_failed' };
  }
}

