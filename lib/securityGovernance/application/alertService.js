import { AlertSeverity } from '../domain/enums.js';

export async function createSecurityAlert(db, {
  businessId = null,
  eventType,
  severity = AlertSeverity.MODERATE,
  actorId = null,
  source = null,
  description,
  evidence = null,
  relatedAuditEventId = null,
} = {}) {
  if (typeof db.secV2SecurityAlert?.create !== 'function') {
    return { persisted: false, eventType, severity, description };
  }
  return db.secV2SecurityAlert.create({
    data: {
      businessId,
      eventType,
      severity,
      actorId,
      source,
      description,
      evidence,
      relatedAuditEventId,
      status: 'OPEN',
      detectedAt: new Date(),
    },
  });
}

export async function acknowledgeAlert(db, context, alertId) {
  return db.secV2SecurityAlert.update({
    where: { id: alertId },
    data: {
      status: 'ACKNOWLEDGED',
      acknowledgedAt: new Date(),
      assignedTo: context.effectiveUserId || context.actorId,
    },
  });
}

export async function getSecurityDashboard(db, businessId) {
  const empty = {
    openAlerts: 0,
    criticalAlerts: 0,
    activeSessions: 0,
    pendingApprovals: 0,
    recentDenials: 0,
    integrityValid: null,
    note: 'Advisory security dashboard — not a compliance certification.',
  };
  if (!db) return empty;

  const [openAlerts, criticalAlerts, activeSessions, pendingApprovals, recentDenials] =
    await Promise.all([
      safeCount(db.secV2SecurityAlert, { businessId, status: 'OPEN' }),
      safeCount(db.secV2SecurityAlert, {
        businessId,
        status: 'OPEN',
        severity: AlertSeverity.CRITICAL,
      }),
      safeCount(db.secV2UserSession, { businessId, status: 'ACTIVE' }),
      safeCount(db.secV2ApprovalRequest, {
        businessId,
        status: { in: ['SUBMITTED', 'IN_REVIEW', 'PARTIALLY_APPROVED'] },
      }),
      safeCount(db.secV2AuditEvent, {
        businessId,
        eventType: 'ACCESS_DENIED',
        recordedAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
      }),
    ]);

  return {
    openAlerts,
    criticalAlerts,
    activeSessions,
    pendingApprovals,
    recentDenials,
    integrityValid: null,
    note: empty.note,
  };
}

async function safeCount(model, where) {
  if (typeof model?.count !== 'function') return 0;
  try {
    return await model.count({ where });
  } catch {
    return 0;
  }
}
