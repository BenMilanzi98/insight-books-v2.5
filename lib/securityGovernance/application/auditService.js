import { buildAuditEvent, verifyAuditChain } from '../domain/auditEvents.js';

/**
 * Append-only write. Never updates or deletes.
 */
export async function appendAuditEvent(db, input) {
  const previous = await db.secV2AuditEvent?.findFirst?.({
    where: { businessId: input.businessId || input.actor?.businessId || null },
    orderBy: { recordedAt: 'desc' },
    select: { integrityHash: true },
  }).catch?.(() => null);

  // Prisma may throw if model missing — handle gracefully
  let previousHash = null;
  try {
    if (typeof db.secV2AuditEvent?.findFirst === 'function') {
      const prev = await db.secV2AuditEvent.findFirst({
        where: { businessId: input.businessId ?? input.actor?.businessId ?? undefined },
        orderBy: { recordedAt: 'desc' },
        select: { integrityHash: true },
      });
      previousHash = prev?.integrityHash || null;
    }
  } catch {
    previousHash = null;
  }

  const event = buildAuditEvent({ ...input, previousHash });

  if (typeof db.secV2AuditEvent?.create !== 'function') {
    return { ...event, persisted: false };
  }

  const row = await db.secV2AuditEvent.create({
    data: {
      businessId: event.businessId,
      eventType: event.eventType,
      eventVersion: event.eventVersion,
      actorType: event.actorType,
      actorId: event.actorId,
      effectiveActorId: event.effectiveActorId,
      impersonatorId: event.impersonatorId,
      sessionId: event.sessionId,
      requestId: event.requestId,
      correlationId: event.correlationId,
      sourceModule: event.sourceModule,
      sourceType: event.sourceType,
      sourceId: event.sourceId,
      action: event.action,
      outcome: event.outcome,
      reason: event.reason,
      previousValueReference: event.previousValueReference,
      newValueReference: event.newValueReference,
      changedFields: event.changedFields,
      approvalReference: event.approvalReference,
      permissionDecision: event.permissionDecision,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      occurredAt: new Date(event.occurredAt),
      integrityHash: event.integrityHash,
      previousHash: event.previousHash,
      metadata: event.metadata,
    },
  });

  return { ...row, persisted: true };
}

export async function searchAuditEvents(db, { businessId, filters = {}, take = 50 } = {}) {
  if (typeof db.secV2AuditEvent?.findMany !== 'function') return [];
  return db.secV2AuditEvent.findMany({
    where: {
      businessId,
      ...(filters.eventType ? { eventType: filters.eventType } : {}),
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
      ...(filters.sourceId ? { sourceId: filters.sourceId } : {}),
      ...(filters.correlationId ? { correlationId: filters.correlationId } : {}),
    },
    orderBy: { recordedAt: 'desc' },
    take: Math.min(Number(take) || 50, 200),
  });
}

export async function runAuditIntegrityCheck(db, businessId, { take = 500 } = {}) {
  const events = await searchAuditEvents(db, { businessId, take });
  // verify oldest→newest
  const chronological = [...events].reverse();
  const result = verifyAuditChain(chronological);
  if (typeof db.secV2AuditIntegrityRun?.create === 'function') {
    await db.secV2AuditIntegrityRun.create({
      data: {
        businessId,
        checkedCount: result.checked,
        valid: result.valid,
        failures: result.failures,
        note: result.note,
      },
    });
  }
  return result;
}

/** Explicitly blocked — audit is append-only */
export function updateAuditEvent() {
  throw new Error('AUDIT_APPEND_ONLY: Audit events cannot be updated.');
}

export function deleteAuditEvent() {
  throw new Error('AUDIT_APPEND_ONLY: Audit events cannot be deleted.');
}
