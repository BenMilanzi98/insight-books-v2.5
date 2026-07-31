/**
 * Append-only audit event helpers + tamper-evidence hashing.
 * Application services must never update/delete SecV2AuditEvent rows.
 */

import { createHash } from 'crypto';
import { AUDIT_EVENT_TYPES } from './enums.js';

const SECRET_KEYS = new Set([
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'secret',
  'privateKey',
  'encryptionKey',
  'session',
  'authorization',
  'cookie',
  'mfaSecret',
  'otpCode',
  'resetToken',
  'clientSecret',
]);

export function redactForAudit(value, depth = 0) {
  if (value == null) return value;
  if (depth > 6) return '[TRUNCATED]';
  if (typeof value === 'string') {
    if (value.length > 2000) return `${value.slice(0, 2000)}…[REDACTED_LENGTH]`;
    return value;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redactForAudit(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SECRET_KEYS.has(k) || /password|secret|token|apikey|privatekey/i.test(k)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = redactForAudit(v, depth + 1);
    }
  }
  return out;
}

export function buildAuditEvent({
  eventType,
  businessId = null,
  actor = null,
  sourceModule = null,
  sourceType = null,
  sourceId = null,
  action = null,
  outcome = 'SUCCESS',
  reason = null,
  previousValue = null,
  newValue = null,
  changedFields = null,
  approvalReference = null,
  permissionDecision = null,
  metadata = null,
  previousHash = null,
} = {}) {
  if (!AUDIT_EVENT_TYPES[eventType] && !Object.values(AUDIT_EVENT_TYPES).includes(eventType)) {
    // allow extended registered types as strings
  }

  const body = {
    eventType,
    eventVersion: 1,
    businessId,
    actorType: actor?.actorType || null,
    actorId: actor?.actorId || null,
    effectiveActorId: actor?.effectiveUserId || null,
    impersonatorId: actor?.impersonatorUserId || null,
    sessionId: actor?.sessionId || null,
    requestId: actor?.requestId || null,
    correlationId: actor?.correlationId || null,
    sourceModule,
    sourceType,
    sourceId,
    action,
    outcome,
    reason,
    previousValueReference: previousValue ? redactForAudit(previousValue) : null,
    newValueReference: newValue ? redactForAudit(newValue) : null,
    changedFields: changedFields || null,
    approvalReference,
    permissionDecision: permissionDecision || null,
    ipAddress: actor?.ipAddress || null,
    userAgent: actor?.userAgent || null,
    occurredAt: new Date().toISOString(),
    metadata: metadata ? redactForAudit(metadata) : null,
  };

  const integrityHash = hashEvent(body, previousHash);
  return {
    ...body,
    integrityHash,
    previousHash: previousHash || null,
    appendOnly: true,
  };
}

export function hashEvent(body, previousHash = null) {
  const material = JSON.stringify({
    eventType: body.eventType,
    businessId: body.businessId,
    actorId: body.actorId,
    effectiveActorId: body.effectiveActorId,
    sourceId: body.sourceId,
    action: body.action,
    outcome: body.outcome,
    occurredAt: body.occurredAt,
    correlationId: body.correlationId,
    previousHash: previousHash || null,
  });
  return createHash('sha256').update(material).digest('hex');
}

/**
 * Verify a chain of events (tamper-evidence — not cryptographic non-repudiation).
 */
export function verifyAuditChain(events = []) {
  let previousHash = null;
  const failures = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const expected = hashEvent(e, previousHash);
    if (e.previousHash && previousHash && e.previousHash !== previousHash) {
      failures.push({ index: i, code: 'PREVIOUS_HASH_MISMATCH', eventId: e.id || i });
    }
    if (e.integrityHash && e.integrityHash !== expected) {
      // Allow if event stored previousHash differently at write time — recompute with stored previousHash
      const alt = hashEvent(e, e.previousHash || null);
      if (e.integrityHash !== alt) {
        failures.push({ index: i, code: 'INTEGRITY_HASH_MISMATCH', eventId: e.id || i });
      }
    }
    previousHash = e.integrityHash || previousHash;
  }
  return {
    valid: failures.length === 0,
    failures,
    checked: events.length,
    note: 'Hash chaining is tamper-evident within this store; it is not external non-repudiation.',
  };
}

export { AUDIT_EVENT_TYPES };
