/**
 * CrmDemo* model guards + serialize — Phase 14 Wave 1.
 * Demo ≠ Meeting; RSVP ≠ attendance; never invent attendance.
 */

import {
  CRM_DEMO_STATUS,
  CRM_READINESS_STATUS,
  getDemoDomainContract,
} from './catalogue.js';

export function hasCrmDemoRequestModel(prisma) {
  return typeof prisma?.crmDemoRequest?.create === 'function';
}

export function hasCrmDemoModel(prisma) {
  return typeof prisma?.crmDemo?.create === 'function';
}

export function hasCrmDemoParticipantModel(prisma) {
  return typeof prisma?.crmDemoParticipant?.create === 'function';
}

export function hasCrmDemoStatusHistoryModel(prisma) {
  return typeof prisma?.crmDemoStatusHistory?.create === 'function';
}

export function serializeDemoRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    requestNumber: row.requestNumber,
    status: row.status,
    leadId: row.leadId || null,
    opportunityId: row.opportunityId || null,
    accountId: row.accountId || null,
    contactId: row.contactId || null,
    title: row.title || null,
    notes: row.notes || null,
    source: row.source || null,
    ownerAdminId: row.ownerAdminId || null,
    createdByAdminId: row.createdByAdminId || null,
    convertedDemoId: row.convertedDemoId || null,
    convertIdempotencyKey: row.convertIdempotencyKey || null,
    rejectedReason: row.rejectedReason || null,
    qualifiedAt: row.qualifiedAt ? new Date(row.qualifiedAt).toISOString() : null,
    convertedAt: row.convertedAt ? new Date(row.convertedAt).toISOString() : null,
    rejectedAt: row.rejectedAt ? new Date(row.rejectedAt).toISOString() : null,
    idempotencyKey: row.idempotencyKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeDemo(row) {
  if (!row) return null;
  return {
    id: row.id,
    demoNumber: row.demoNumber,
    status: row.status || CRM_DEMO_STATUS.DRAFT,
    readinessStatus: row.readinessStatus || CRM_READINESS_STATUS.NOT_READY,
    readinessJson: row.readinessJson ?? null,
    requestId: row.requestId || null,
    leadId: row.leadId || null,
    opportunityId: row.opportunityId || null,
    accountId: row.accountId || null,
    contactId: row.contactId || null,
    meetingId: row.meetingId || null,
    calendarEventId: row.calendarEventId || null,
    title: row.title || null,
    notes: row.notes || null,
    timezone: row.timezone || null,
    startsAtUtc: row.startsAtUtc ? new Date(row.startsAtUtc).toISOString() : null,
    endsAtUtc: row.endsAtUtc ? new Date(row.endsAtUtc).toISOString() : null,
    startsAtOriginal: row.startsAtOriginal || null,
    endsAtOriginal: row.endsAtOriginal || null,
    ownerAdminId: row.ownerAdminId || null,
    createdByAdminId: row.createdByAdminId || null,
    convertIdempotencyKey: row.convertIdempotencyKey || null,
    scheduleIdempotencyKey: row.scheduleIdempotencyKey || null,
    idempotencyKey: row.idempotencyKey || null,
    pinnedAgendaId: row.pinnedAgendaId || null,
    pinnedScriptId: row.pinnedScriptId || null,
    pinnedScenarioId: row.pinnedScenarioId || null,
    pinnedContentId: row.pinnedContentId || null,
    requiresLogicalEnvironment: row.requiresLogicalEnvironment === true,
    requiresChecklist: row.requiresChecklist === true,
    requiresRehearsal: row.requiresRehearsal === true,
    environmentId: row.environmentId || null,
    pinnedChecklistId: row.pinnedChecklistId || null,
    latestChecklistExecutionId: row.latestChecklistExecutionId || null,
    latestRehearsalId: row.latestRehearsalId || null,
    latestDeliverySessionId: row.latestDeliverySessionId || null,
    latestOutcomeId: row.latestOutcomeId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    /** Honesty — Wave 1 never fabricates these */
    attendanceFabricated: false,
    proposalCreated: false,
    tenantProvisioned: false,
    domain: getDemoDomainContract(),
  };
}

export function serializeDemoParticipant(row) {
  if (!row) return null;
  return {
    id: row.id,
    demoId: row.demoId,
    participantType: row.participantType,
    participantId: row.participantId,
    role: row.role || 'REQUIRED',
    rsvpStatus: row.rsvpStatus || 'PENDING',
    /** Attendance never inferred from RSVP — Wave 4 owns recording */
    attendanceStatus: row.attendanceStatus || 'UNKNOWN',
    invitationStatus: row.invitationStatus || 'NOT_SENT',
    eligibilityJson: row.eligibilityJson ?? null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeDemoStatusHistory(row) {
  if (!row) return null;
  return {
    id: row.id,
    demoId: row.demoId,
    fromStatus: row.fromStatus || null,
    toStatus: row.toStatus,
    reason: row.reason || null,
    changedByAdminId: row.changedByAdminId || null,
    at: row.at ? new Date(row.at).toISOString() : null,
  };
}

export { getDemoDomainContract };
