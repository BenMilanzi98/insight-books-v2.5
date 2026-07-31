import { createHash, randomBytes } from 'crypto';
import { appendAuditEvent } from './auditService.js';
import { AUDIT_EVENT_TYPES } from '../domain/enums.js';

function hashKey(raw) {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Create API key — raw secret shown once.
 */
export async function createApiKey(db, context, {
  name,
  scopes = [],
  expiresAt = null,
  purpose = null,
} = {}) {
  const raw = `ibk_${randomBytes(24).toString('hex')}`;
  const keyHash = hashKey(raw);
  const keyPrefix = raw.slice(0, 12);

  const row = await db.secV2ApiKey.create({
    data: {
      businessId: context.businessId,
      name: name || 'API Key',
      keyPrefix,
      keyHash,
      scopes,
      status: 'ACTIVE',
      purpose,
      createdBy: context.effectiveUserId || context.actorId,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  await appendAuditEvent(db, {
    eventType: 'PERMISSION_GRANTED',
    businessId: context.businessId,
    actor: context,
    sourceModule: 'securityGovernance',
    sourceType: 'ApiKey',
    sourceId: row.id,
    action: 'CREATE_API_KEY',
    outcome: 'SUCCESS',
    metadata: { keyPrefix, scopes },
  });

  return {
    apiKey: row,
    rawSecret: raw,
    shownOnce: true,
    note: 'Store this secret securely. It will not be shown again.',
  };
}

export async function revokeApiKey(db, context, apiKeyId) {
  const row = await db.secV2ApiKey.findFirst({
    where: { id: apiKeyId, businessId: context.businessId },
  });
  if (!row) throw new Error('API key not found.');
  return db.secV2ApiKey.update({
    where: { id: apiKeyId },
    data: { status: 'REVOKED', revokedAt: new Date(), revokedBy: context.effectiveUserId },
  });
}

export async function verifyApiKey(db, rawKey) {
  if (!rawKey || typeof db.secV2ApiKey?.findFirst !== 'function') return null;
  const keyHash = hashKey(rawKey);
  const row = await db.secV2ApiKey.findFirst({
    where: { keyHash, status: 'ACTIVE' },
  });
  if (!row) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;
  await db.secV2ApiKey.update({
    where: { id: row.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});
  return row;
}
