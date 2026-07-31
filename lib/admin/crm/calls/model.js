/**
 * CrmCall model guards + serialize — Phase 13 Wave 2.
 */

import {
  CRM_CALL_RECORDING_STATUS,
  CRM_TELEPHONY_PROVIDER_STATUS,
} from '../catalogue.js';

export function hasCrmCallModel(prisma) {
  return typeof prisma?.crmCall?.create === 'function';
}

export function serializeCall(row) {
  if (!row) return null;
  return {
    id: row.id,
    callNumber: row.callNumber,
    activityId: row.activityId || null,
    direction: row.direction,
    status: row.status,
    outcome: row.outcome || null,
    contactId: row.contactId || null,
    subjectType: row.subjectType || null,
    subjectId: row.subjectId || null,
    phoneNumber: row.phoneNumber || null,
    scheduledAt: row.scheduledAt ? new Date(row.scheduledAt).toISOString() : null,
    completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
    /** Telephony CONNECTED never fabricated — only manual outcome CONNECTED_MANUAL */
    telephonyConnected: false,
    telephonyProviderStatus: CRM_TELEPHONY_PROVIDER_STATUS,
    recordingStatus: CRM_CALL_RECORDING_STATUS,
    consentBlocked: Boolean(row.consentBlocked),
    eligibilityJson: row.eligibilityJson ?? null,
    notes: row.notes || null,
    ownerAdminId: row.ownerAdminId || null,
    createdByAdminId: row.createdByAdminId || null,
    idempotencyKey: row.idempotencyKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}
