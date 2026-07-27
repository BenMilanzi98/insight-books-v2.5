import prisma from '@/lib/prisma.js';
import { redactSecrets } from './security/redaction.js';

/**
 * Append-only EIS control audit. Also mirrors admin actions to AdminAuditLog when actorType=ADMIN.
 * Metadata is always redacted — never persist secrets in audit rows.
 */
export async function recordEisControlAudit(event, db = prisma) {
  const row = await db.mraEisControlAuditEvent.create({
    data: {
      tenantId: event.tenantId || null,
      businessId: event.businessId || event.tenantId || null,
      actorId: event.actorId || null,
      effectiveActorId: event.effectiveActorId || event.actorId || null,
      actorType: event.actorType || 'SYSTEM',
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId || null,
      previousStatus: event.previousStatus || null,
      newStatus: event.newStatus || null,
      reason: event.reason || null,
      environment: event.environment || null,
      approvalReference: event.approvalReference || null,
      requestId: event.requestId || null,
      correlationId: event.correlationId || null,
      outcome: event.outcome || 'SUCCESS',
      safeErrorCode: event.safeErrorCode || null,
      metadata: event.metadata ? redactSecrets(event.metadata) : undefined,
    },
  });

  if (event.actorType === 'ADMIN' && event.actorId) {
    try {
      await db.adminAuditLog.create({
        data: {
          adminId: event.actorId,
          action: `MRA_EIS_${String(event.action || 'EVENT').toUpperCase()}`,
          entityType: event.resourceType || 'MRA_EIS',
          entityId: event.resourceId || event.tenantId || 'platform',
          details: JSON.stringify({
            tenantId: event.tenantId,
            previousStatus: event.previousStatus,
            newStatus: event.newStatus,
            reason: event.reason,
            requestId: event.requestId,
          }),
          ipAddress: event.ipAddress || null,
          userAgent: event.userAgent || null,
        },
      });
    } catch {
      // Control audit remains authoritative if AdminAuditLog write fails.
    }
  }

  return row;
}
