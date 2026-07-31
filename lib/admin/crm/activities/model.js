/**
 * CrmActivity model guards + serialize — Phase 13 Wave 1.
 */

export function hasCrmActivityModel(prisma) {
  return typeof prisma?.crmActivity?.findUnique === 'function';
}

export function hasCrmActivityStatusHistoryModel(prisma) {
  return typeof prisma?.crmActivityStatusHistory?.create === 'function';
}

export function hasCrmActivityRelationModel(prisma) {
  return typeof prisma?.crmActivityRelation?.create === 'function';
}

export function hasCrmActivityParticipantModel(prisma) {
  return typeof prisma?.crmActivityParticipant?.create === 'function';
}

export function serializeActivity(row) {
  if (!row) return null;
  return {
    id: row.id,
    activityNumber: row.activityNumber,
    type: row.type,
    status: row.status,
    direction: row.direction || null,
    title: row.title || null,
    outcome: row.outcome || null,
    ownerAdminId: row.ownerAdminId || null,
    createdByAdminId: row.createdByAdminId || null,
    timezone: row.timezone || null,
    dueAt: row.dueAt ? new Date(row.dueAt).toISOString() : null,
    completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
    primarySubjectType: row.primarySubjectType || null,
    primarySubjectId: row.primarySubjectId || null,
    idempotencyKey: row.idempotencyKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}
