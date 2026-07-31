/**
 * Commercial document delivery — Phase 15 Wave 3.
 * Delivery ≠ view ≠ acceptance. Never fabricates views or acceptance.
 */

import { CRM_SUBJECT_TYPE, CRM_TIMELINE_EVENT_TYPE } from '../catalogue.js';
import { appendTimelineEvent } from '../timeline.js';
import { getCommercialDomainContract } from './catalogue.js';
import { resolveCommercialActor } from './model.js';

export const CRM_DELIVERY_METHOD = Object.freeze({
  EMAIL: 'EMAIL',
  SECURE_LINK: 'SECURE_LINK',
  PORTAL: 'PORTAL',
  MANUAL_EVIDENCE: 'MANUAL_EVIDENCE',
});

export function hasCrmCommercialDeliveryModel(prisma) {
  return typeof prisma?.crmCommercialDelivery?.create === 'function';
}

export function hasCrmCommercialRecipientModel(prisma) {
  return typeof prisma?.crmCommercialRecipient?.create === 'function';
}

export function serializeDelivery(row) {
  if (!row) return null;
  return {
    id: row.id,
    documentVersionId: row.documentVersionId,
    recipientId: row.recipientId || null,
    method: row.method || row.deliveryMethod || null,
    status: row.status || null,
    artifactId: row.artifactId || null,
    reviewAccessId: row.reviewAccessId || null,
    evidenceJson: row.evidenceJson ?? null,
    idempotencyKey: row.idempotencyKey || null,
    deliveredAt: row.deliveredAt ? new Date(row.deliveredAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

/**
 * Record a delivery event. Does NOT create customer views.
 */
export async function recordCommercialDelivery(prisma, args = {}) {
  if (!hasCrmCommercialDeliveryModel(prisma)) {
    return {
      ok: false,
      error: 'crm_commercial_delivery_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const idempotencyKey = args.idempotencyKey ? String(args.idempotencyKey).trim() : '';
  if (idempotencyKey) {
    const existing = await prisma.crmCommercialDelivery.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return {
        ok: true,
        alreadyExists: true,
        delivery: serializeDelivery(existing),
        domain: getCommercialDomainContract(),
      };
    }
  }

  const now = args.now || new Date();
  const method = String(args.deliveryMethod || args.method || CRM_DELIVERY_METHOD.SECURE_LINK)
    .trim()
    .toUpperCase();

  const row = await prisma.crmCommercialDelivery.create({
    data: {
      documentVersionId: args.documentVersionId,
      documentId: args.documentId || null,
      recipientId: args.recipientId || null,
      method,
      deliveryMethod: method,
      status: args.status || 'DELIVERED',
      artifactId: args.artifactId || null,
      reviewAccessId: args.reviewAccessId || null,
      evidenceJson: args.evidenceJson ?? null,
      validUntil: args.validUntil ? new Date(args.validUntil) : null,
      idempotencyKey: idempotencyKey || null,
      deliveredAt: now,
      createdByAdminId: resolveCommercialActor(args)?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  await appendTimelineEvent(prisma, {
    subjectType: args.opportunityId
      ? CRM_SUBJECT_TYPE.OPPORTUNITY
      : CRM_SUBJECT_TYPE.ACCOUNT,
    subjectId: args.opportunityId || args.accountId || args.documentVersionId,
    eventType: CRM_TIMELINE_EVENT_TYPE.NOTE_ADDED,
    summary: `Commercial document delivered via ${method}`,
    payload: {
      deliveryId: row.id,
      documentVersionId: args.documentVersionId,
      method,
      viewCreated: false,
      acceptanceCreated: false,
    },
    actorAdminId: resolveCommercialActor(args)?.id || null,
    at: now,
  });

  return {
    ok: true,
    delivery: serializeDelivery(row),
    viewCreated: false,
    domain: getCommercialDomainContract(),
  };
}
