import { randomUUID } from 'crypto';
import { encodeSessionToken } from '../domain/sessionToken.js';
import { SessionRevokedError } from '../domain/errors.js';
import { appendAuditEvent } from './auditService.js';
import { AUDIT_EVENT_TYPES } from '../domain/enums.js';

export async function createTrackedSession(db, {
  userId,
  businessId,
  branchId = null,
  role = null,
  ipAddress = null,
  userAgent = null,
  absoluteLifetimeSec = 60 * 60 * 24 * 7,
} = {}) {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + absoluteLifetimeSec * 1000);
  const token = encodeSessionToken({
    userId,
    tenantId: businessId,
    branchId,
    role,
    sessionId,
  }, { sessionId });

  if (typeof db.secV2UserSession?.create === 'function') {
    await db.secV2UserSession.create({
      data: {
        id: sessionId,
        userId,
        businessId,
        status: 'ACTIVE',
        ipAddress,
        userAgent: userAgent ? String(userAgent).slice(0, 240) : null,
        expiresAt,
        lastSeenAt: new Date(),
      },
    });
  }

  return { sessionId, token, expiresAt };
}

export async function assertSessionActive(db, sessionId) {
  if (!sessionId || typeof db.secV2UserSession?.findUnique !== 'function') return true;
  const row = await db.secV2UserSession.findUnique({ where: { id: sessionId } });
  if (!row) return true; // legacy sessions without tracking
  if (row.status !== 'ACTIVE') throw new SessionRevokedError();
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    throw new SessionRevokedError('Session expired.');
  }
  await db.secV2UserSession.update({
    where: { id: sessionId },
    data: { lastSeenAt: new Date() },
  }).catch(() => {});
  return true;
}

export async function revokeSession(db, context, sessionId, reason = 'REVOKED') {
  if (typeof db.secV2UserSession?.update !== 'function') return null;
  const row = await db.secV2UserSession.findFirst({
    where: { id: sessionId, businessId: context.businessId },
  });
  if (!row) return null;
  const updated = await db.secV2UserSession.update({
    where: { id: sessionId },
    data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: reason },
  });
  await appendAuditEvent(db, {
    eventType: AUDIT_EVENT_TYPES.SESSION_REVOKED,
    businessId: context.businessId,
    actor: context,
    sourceId: sessionId,
    outcome: 'SUCCESS',
    reason,
  });
  return updated;
}

export async function revokeAllUserSessions(db, context, userId, { exceptSessionId } = {}) {
  if (typeof db.secV2UserSession?.updateMany !== 'function') return { count: 0 };
  const result = await db.secV2UserSession.updateMany({
    where: {
      userId,
      businessId: context.businessId,
      status: 'ACTIVE',
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: 'BULK_REVOKE' },
  });
  return result;
}

export async function listActiveSessions(db, businessId, userId) {
  if (typeof db.secV2UserSession?.findMany !== 'function') return [];
  return db.secV2UserSession.findMany({
    where: { businessId, userId, status: 'ACTIVE' },
    orderBy: { lastSeenAt: 'desc' },
    take: 50,
  });
}
