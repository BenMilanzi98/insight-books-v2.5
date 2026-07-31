/**
 * CrmEmail* model guards + serialize — Phase 13 Wave 2.
 */

import { CRM_EMAIL_TRACKING_PIXELS_ENABLED } from './catalogue.js';

export function hasCrmEmailActivityModel(prisma) {
  return typeof prisma?.crmEmailActivity?.create === 'function';
}

export function hasCrmEmailSendRequestModel(prisma) {
  return typeof prisma?.crmEmailSendRequest?.create === 'function';
}

export function hasCrmEmailDeliveryEventModel(prisma) {
  return typeof prisma?.crmEmailDeliveryEvent?.create === 'function';
}

export function hasCrmEmailTemplateModel(prisma) {
  return typeof prisma?.crmEmailTemplate?.create === 'function';
}

export function serializeEmailActivity(row) {
  if (!row) return null;
  return {
    id: row.id,
    activityId: row.activityId || null,
    status: row.status,
    direction: row.direction || 'OUTBOUND',
    contactId: row.contactId || null,
    toAddress: row.toAddress || null,
    subject: row.subject || null,
    bodyHtml: row.bodyHtml || null,
    bodyText: row.bodyText || null,
    templateCode: row.templateCode || null,
    templateVersion: row.templateVersion ?? null,
    subjectType: row.subjectType || null,
    subjectId: row.subjectId || null,
    purpose: row.purpose || null,
    consentBlocked: Boolean(row.consentBlocked),
    eligibilityJson: row.eligibilityJson ?? null,
    trackingPixels: CRM_EMAIL_TRACKING_PIXELS_ENABLED,
    opensFabricated: false,
    repliesFabricated: false,
    ownerAdminId: row.ownerAdminId || null,
    createdByAdminId: row.createdByAdminId || null,
    idempotencyKey: row.idempotencyKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeSendRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    emailActivityId: row.emailActivityId,
    idempotencyKey: row.idempotencyKey,
    status: row.status,
    providerMessageId: row.providerMessageId || null,
    providerResponse: row.providerResponse || null,
    error: row.error || null,
    eligibilityJson: row.eligibilityJson ?? null,
    /** SMTP accept ≠ mailbox delivered */
    delivered: row.status === 'DELIVERED',
    inventDeliveredForbidden: true,
    requestedAt: row.requestedAt
      ? new Date(row.requestedAt).toISOString()
      : null,
    completedAt: row.completedAt
      ? new Date(row.completedAt).toISOString()
      : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

export function serializeDeliveryEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    sendRequestId: row.sendRequestId,
    eventType: row.eventType,
    evidenceJson: row.evidenceJson ?? null,
    at: row.at ? new Date(row.at).toISOString() : null,
  };
}

export function serializeEmailTemplate(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    version: row.version,
    status: row.status,
    name: row.name || null,
    subjectTemplate: row.subjectTemplate || null,
    bodyHtmlTemplate: row.bodyHtmlTemplate || null,
    bodyTextTemplate: row.bodyTextTemplate || null,
    executableExpressions: false,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}
