/**
 * createCrmActivity — Phase 13 Wave 1 spine.
 * One Activity record; entity views project via relations — never duplicate per entity.
 */

import {
  CRM_ACTIVITY_DIRECTION,
  CRM_ACTIVITY_RELATION_ROLE,
  CRM_ACTIVITY_STATUS,
  CRM_ACTIVITY_TYPE,
  CRM_ACTIVITY_TYPES_CREATABLE,
  CRM_SUBJECT_TYPE,
  CRM_SUBJECT_TYPES,
  CRM_TIMELINE_EVENT_TYPE,
} from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { appendTimelineEvent } from '../timeline.js';
import {
  isActivityStatusCompatible,
} from './catalogue.js';
import { allocateActivityNumber } from './numbering.js';
import {
  hasCrmActivityModel,
  hasCrmActivityStatusHistoryModel,
  serializeActivity,
} from './model.js';
import { linkActivityRelation } from './relations.js';
import {
  addActivityParticipant,
  CRM_ACTIVITY_PARTICIPANT_ROLE,
  CRM_ACTIVITY_PARTICIPANT_TYPE,
} from './participants.js';

const CREATABLE_TYPE_SET = new Set(CRM_ACTIVITY_TYPES_CREATABLE);
const SUBJECT_SET = new Set(
  CRM_SUBJECT_TYPES.filter((s) => s !== CRM_SUBJECT_TYPE.ACTIVITY)
);

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   type: string,
 *   status?: string,
 *   direction?: string,
 *   title?: string|null,
 *   outcome?: string|null,
 *   ownerAdminId?: string|null,
 *   timezone?: string|null,
 *   dueAt?: Date|string|null,
 *   primarySubjectType?: string|null,
 *   primarySubjectId?: string|null,
 *   idempotencyKey?: string|null,
 *   now?: Date,
 * }} args
 */
export async function createCrmActivity(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canEditActivities &&
    !access.canEditLeads &&
    !access.canCreateLeads &&
    !access.canEditOpportunities
  ) {
    return { ok: false, forbidden: true, reason: 'crm_activity_create_forbidden' };
  }

  const type = String(args.type || '').trim().toUpperCase();
  if (!CREATABLE_TYPE_SET.has(type)) {
    return { ok: false, error: 'invalid_or_deferred_activity_type', type };
  }

  const status = String(args.status || CRM_ACTIVITY_STATUS.OPEN)
    .trim()
    .toUpperCase();
  if (!isActivityStatusCompatible(type, status)) {
    return {
      ok: false,
      error: 'incompatible_activity_type_status',
      type,
      status,
    };
  }

  const direction = String(
    args.direction ||
      (type === CRM_ACTIVITY_TYPE.NOTE
        ? CRM_ACTIVITY_DIRECTION.INTERNAL
        : CRM_ACTIVITY_DIRECTION.INTERNAL)
  )
    .trim()
    .toUpperCase();

  if (!hasCrmActivityModel(prisma)) {
    return {
      ok: false,
      error: 'crm_activity_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const now = args.now || new Date();
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;

  if (idempotencyKey) {
    try {
      const existing = await prisma.crmActivity.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return {
          ok: true,
          activity: serializeActivity(existing),
          alreadyExists: true,
        };
      }
    } catch {
      // continue
    }
  }

  const allocated = await allocateActivityNumber(prisma, { now });
  if (!allocated.ok) {
    return { ok: false, error: allocated.error || 'activity_number_allocation_failed' };
  }

  const primarySubjectType = args.primarySubjectType
    ? String(args.primarySubjectType).trim().toUpperCase()
    : null;
  const primarySubjectId = args.primarySubjectId
    ? String(args.primarySubjectId).trim()
    : null;

  if (primarySubjectType && !SUBJECT_SET.has(primarySubjectType)) {
    return { ok: false, error: 'invalid_primary_subject_type' };
  }
  if (Boolean(primarySubjectType) !== Boolean(primarySubjectId)) {
    return { ok: false, error: 'primary_subject_type_and_id_required_together' };
  }

  const dueAt = args.dueAt ? new Date(args.dueAt) : null;
  // Planned ≠ completed — dueAt in the past must not force COMPLETED
  const row = await prisma.crmActivity.create({
    data: {
      activityNumber: allocated.number,
      type,
      status,
      direction,
      title: args.title != null ? String(args.title).trim().slice(0, 500) : null,
      outcome: args.outcome != null ? String(args.outcome).trim().slice(0, 200) : null,
      ownerAdminId: args.ownerAdminId || args.admin?.id || null,
      createdByAdminId: args.admin?.id || null,
      timezone: args.timezone ? String(args.timezone).trim().slice(0, 80) : null,
      dueAt: dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null,
      completedAt: status === CRM_ACTIVITY_STATUS.COMPLETED ? now : null,
      primarySubjectType,
      primarySubjectId,
      idempotencyKey: idempotencyKey || undefined,
      createdAt: now,
      updatedAt: now,
    },
  });

  if (hasCrmActivityStatusHistoryModel(prisma)) {
    try {
      await prisma.crmActivityStatusHistory.create({
        data: {
          activityId: row.id,
          fromStatus: null,
          toStatus: status,
          changedByAdminId: args.admin?.id || null,
          reason: 'created',
          at: now,
        },
      });
    } catch {
      // best-effort
    }
  }

  if (primarySubjectType && primarySubjectId) {
    await linkActivityRelation(prisma, {
      activityId: row.id,
      relatedType: primarySubjectType,
      relatedId: primarySubjectId,
      role: CRM_ACTIVITY_RELATION_ROLE.PRIMARY,
      now,
    });

    await appendTimelineEvent(prisma, {
      subjectType: primarySubjectType,
      subjectId: primarySubjectId,
      eventType: CRM_TIMELINE_EVENT_TYPE.ACTIVITY_CREATED,
      summary: `Activity created: ${String(row.title || type).slice(0, 120)}`,
      payload: {
        activityId: row.id,
        activityNumber: row.activityNumber,
        type,
        status,
      },
      actorAdminId: args.admin?.id || null,
      at: now,
    });
  }

  if (row.ownerAdminId) {
    await addActivityParticipant(prisma, {
      activityId: row.id,
      participantType: CRM_ACTIVITY_PARTICIPANT_TYPE.ADMIN,
      participantId: row.ownerAdminId,
      role: CRM_ACTIVITY_PARTICIPANT_ROLE.OWNER,
      now,
    });
  }

  return { ok: true, activity: serializeActivity(row) };
}
