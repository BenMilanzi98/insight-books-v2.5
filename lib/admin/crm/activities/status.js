/**
 * transitionActivityStatus — Phase 13 Wave 1.
 * Fail-closed on incompatible type↔status and illegal transitions.
 * Due-date alone never completes an Activity.
 */

import {
  CRM_ACTIVITY_STATUS,
  CRM_SUBJECT_TYPE,
  CRM_TIMELINE_EVENT_TYPE,
} from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { appendTimelineEvent } from '../timeline.js';
import {
  canTransitionActivityStatus,
  isActivityStatusCompatible,
} from './catalogue.js';
import {
  hasCrmActivityModel,
  hasCrmActivityStatusHistoryModel,
  serializeActivity,
} from './model.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   activityId: string,
 *   toStatus: string,
 *   reason?: string|null,
 *   now?: Date,
 * }} args
 */
export async function transitionActivityStatus(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canEditActivities &&
    !access.canEditLeads &&
    !access.canEditOpportunities
  ) {
    return { ok: false, forbidden: true, reason: 'crm_activity_edit_forbidden' };
  }

  const activityId = args.activityId ? String(args.activityId).trim() : '';
  const toStatus = String(args.toStatus || '').trim().toUpperCase();
  if (!activityId) return { ok: false, error: 'activityId_required' };
  if (!toStatus) return { ok: false, error: 'toStatus_required' };

  if (!hasCrmActivityModel(prisma)) {
    return {
      ok: false,
      error: 'crm_activity_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  let row = null;
  try {
    row = await prisma.crmActivity.findUnique({ where: { id: activityId } });
  } catch {
    row = null;
  }
  if (!row) return { ok: false, notFound: true, error: 'activity_not_found' };

  if (!isActivityStatusCompatible(row.type, toStatus)) {
    return {
      ok: false,
      error: 'incompatible_activity_type_status',
      type: row.type,
      status: toStatus,
    };
  }

  if (!canTransitionActivityStatus(row.status, toStatus)) {
    return {
      ok: false,
      error: 'invalid_activity_status_transition',
      from: row.status,
      to: toStatus,
    };
  }

  if (row.status === toStatus) {
    return { ok: true, activity: serializeActivity(row), alreadyInStatus: true };
  }

  const now = args.now || new Date();
  const data = {
    status: toStatus,
    updatedAt: now,
  };
  if (toStatus === CRM_ACTIVITY_STATUS.COMPLETED) {
    data.completedAt = now;
  } else if (row.status === CRM_ACTIVITY_STATUS.COMPLETED) {
    data.completedAt = null;
  }

  const updated = await prisma.crmActivity.update({
    where: { id: row.id },
    data,
  });

  if (hasCrmActivityStatusHistoryModel(prisma)) {
    try {
      await prisma.crmActivityStatusHistory.create({
        data: {
          activityId: row.id,
          fromStatus: row.status,
          toStatus,
          changedByAdminId: args.admin?.id || null,
          reason: args.reason != null ? String(args.reason).slice(0, 500) : null,
          at: now,
        },
      });
    } catch {
      // best-effort
    }
  }

  if (row.primarySubjectType && row.primarySubjectId) {
    await appendTimelineEvent(prisma, {
      subjectType: row.primarySubjectType,
      subjectId: row.primarySubjectId,
      eventType: CRM_TIMELINE_EVENT_TYPE.ACTIVITY_STATUS_CHANGED,
      summary: `Activity ${row.activityNumber}: ${row.status} → ${toStatus}`,
      payload: {
        activityId: row.id,
        activityNumber: row.activityNumber,
        fromStatus: row.status,
        toStatus,
      },
      actorAdminId: args.admin?.id || null,
      at: now,
    });
  }

  // Also project onto ACTIVITY subject when notes/timeline use it
  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.ACTIVITY,
    subjectId: row.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.ACTIVITY_STATUS_CHANGED,
    summary: `Status ${row.status} → ${toStatus}`,
    payload: {
      activityId: row.id,
      fromStatus: row.status,
      toStatus,
    },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return { ok: true, activity: serializeActivity(updated) };
}
