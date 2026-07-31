/**
 * CRM Follow-Ups — Phase 13 Wave 1.
 * Consent-blocked Follow-Ups → BLOCKED_BY_CONSENT; never auto-executed.
 * Distinct from CsTask / CS playbook steps.
 */

import {
  CRM_ACTIVITY_DIRECTION,
  CRM_ACTIVITY_STATUS,
  CRM_ACTIVITY_TYPE,
  CRM_COMMUNICATION_CHANNEL,
  CRM_CONSENT_PURPOSE,
  CRM_FOLLOW_UP_STATUS,
  CRM_LIST_DEFAULT_LIMIT,
  CRM_LIST_MAX_LIMIT,
  CRM_SUBJECT_TYPE,
  CRM_SUBJECT_TYPES,
  CRM_TIMELINE_EVENT_TYPE,
} from './catalogue.js';
import { resolveCrmAccess } from './authz.js';
import { checkCommunicationEligibility } from './eligibility.js';
import { appendTimelineEvent } from './timeline.js';
import {
  createCrmActivity,
  hasCrmActivityModel,
  transitionActivityStatus,
} from './activities/index.js';

const SUBJECT_SET = new Set(
  CRM_SUBJECT_TYPES.filter((s) => s !== CRM_SUBJECT_TYPE.ACTIVITY)
);
const OPENISH = new Set([
  CRM_FOLLOW_UP_STATUS.PLANNED,
  CRM_FOLLOW_UP_STATUS.OPEN,
  CRM_FOLLOW_UP_STATUS.BLOCKED_BY_CONSENT,
]);

export function hasCrmFollowUpModel(prisma) {
  return typeof prisma?.crmFollowUp?.findUnique === 'function';
}

export function hasCrmFollowUpHistoryModel(prisma) {
  return typeof prisma?.crmFollowUpHistory?.create === 'function';
}

function serializeFollowUp(row) {
  if (!row) return null;
  return {
    id: row.id,
    activityId: row.activityId || null,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    title: row.title || null,
    status: row.status,
    channel: row.channel || null,
    contactId: row.contactId || null,
    purpose: row.purpose || null,
    dueAt: row.dueAt ? new Date(row.dueAt).toISOString() : null,
    completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
    ownerAdminId: row.ownerAdminId || null,
    createdByAdminId: row.createdByAdminId || null,
    consentBlocked: Boolean(row.consentBlocked),
    eligibilityJson: row.eligibilityJson ?? null,
    autoExecuted: false,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

async function recordFollowUpHistory(prisma, data) {
  if (!hasCrmFollowUpHistoryModel(prisma)) return;
  try {
    await prisma.crmFollowUpHistory.create({ data });
  } catch {
    // best-effort
  }
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   subjectType?: string,
 *   subjectId: string,
 *   title: string,
 *   dueAt?: Date|string|null,
 *   channel?: string|null,
 *   contactId?: string|null,
 *   purpose?: string|null,
 *   ownerAdminId?: string|null,
 *   now?: Date,
 * }} args
 */
export async function createFollowUp(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canEditActivities &&
    !access.canEditLeads &&
    !access.canEditOpportunities
  ) {
    return { ok: false, forbidden: true, reason: 'crm_follow_up_create_forbidden' };
  }

  const subjectType = String(args.subjectType || CRM_SUBJECT_TYPE.LEAD)
    .trim()
    .toUpperCase();
  const subjectId = args.subjectId ? String(args.subjectId).trim() : '';
  const title = args.title != null ? String(args.title).trim() : '';
  if (!SUBJECT_SET.has(subjectType) || !subjectId) {
    return { ok: false, error: 'subjectType_and_subjectId_required' };
  }
  if (!title) return { ok: false, error: 'title_required' };

  if (!hasCrmFollowUpModel(prisma)) {
    return {
      ok: false,
      error: 'crm_follow_up_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const now = args.now || new Date();
  const dueAt = args.dueAt ? new Date(args.dueAt) : null;
  const channel = args.channel
    ? String(args.channel).trim().toUpperCase()
    : null;
  const contactId = args.contactId ? String(args.contactId).trim() : null;
  const purpose = args.purpose
    ? String(args.purpose).trim().toUpperCase()
    : CRM_CONSENT_PURPOSE.SALES_CONTACT;

  let consentBlocked = false;
  let eligibilityJson = null;
  let followUpStatus = CRM_FOLLOW_UP_STATUS.OPEN;
  let activityStatus = CRM_ACTIVITY_STATUS.OPEN;

  // Outbound channel + contact → eligibility; UNKNOWN/DENIED → BLOCKED, never auto-execute
  if (
    contactId &&
    channel &&
    Object.values(CRM_COMMUNICATION_CHANNEL).includes(channel)
  ) {
    const elig = await checkCommunicationEligibility(prisma, {
      contactId,
      purpose,
      channel,
    });
    eligibilityJson = {
      eligible: elig.eligible,
      reasons: elig.reasons,
      consentStatus: elig.consentStatus,
      dncFlags: elig.dncFlags,
      inferred: false,
      evaluatedAt: now.toISOString(),
    };
    if (!elig.eligible) {
      consentBlocked = true;
      followUpStatus = CRM_FOLLOW_UP_STATUS.BLOCKED_BY_CONSENT;
      activityStatus = CRM_ACTIVITY_STATUS.BLOCKED_BY_CONSENT;
    }
  }

  let activity = null;
  if (hasCrmActivityModel(prisma)) {
    const actResult = await createCrmActivity(prisma, {
      admin: args.admin,
      type: CRM_ACTIVITY_TYPE.FOLLOW_UP,
      status: activityStatus,
      direction: channel
        ? CRM_ACTIVITY_DIRECTION.OUTBOUND
        : CRM_ACTIVITY_DIRECTION.INTERNAL,
      title,
      ownerAdminId: args.ownerAdminId || args.admin?.id || null,
      dueAt: dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null,
      primarySubjectType: subjectType,
      primarySubjectId: subjectId,
      now,
    });
    if (!actResult.ok) {
      return {
        ok: false,
        error: actResult.error || 'activity_create_failed',
        forbidden: actResult.forbidden,
        reason: actResult.reason,
      };
    }
    activity = actResult.activity;
  }

  const row = await prisma.crmFollowUp.create({
    data: {
      activityId: activity?.id || null,
      subjectType,
      subjectId,
      title,
      status: followUpStatus,
      channel,
      contactId,
      purpose,
      dueAt: dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null,
      ownerAdminId: args.ownerAdminId || args.admin?.id || null,
      createdByAdminId: args.admin?.id || null,
      consentBlocked,
      eligibilityJson: eligibilityJson ?? undefined,
      createdAt: now,
      updatedAt: now,
    },
  });

  await recordFollowUpHistory(prisma, {
    followUpId: row.id,
    fromStatus: null,
    toStatus: followUpStatus,
    dueAt: row.dueAt,
    changedByAdminId: args.admin?.id || null,
    reason: consentBlocked ? 'blocked_by_consent' : 'created',
    at: now,
  });

  await appendTimelineEvent(prisma, {
    subjectType,
    subjectId,
    eventType: CRM_TIMELINE_EVENT_TYPE.FOLLOW_UP_CREATED,
    summary: consentBlocked
      ? `Follow-Up blocked by consent: ${title.slice(0, 100)}`
      : `Follow-Up created: ${title.slice(0, 120)}`,
    payload: {
      followUpId: row.id,
      activityId: activity?.id || null,
      status: followUpStatus,
      consentBlocked,
      autoExecuted: false,
    },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return {
    ok: true,
    followUp: serializeFollowUp(row),
    activity,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, followUpId: string, now?: Date }} args
 */
export async function completeFollowUp(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canEditActivities &&
    !access.canEditLeads &&
    !access.canEditOpportunities
  ) {
    return { ok: false, forbidden: true, reason: 'crm_follow_up_complete_forbidden' };
  }

  const followUpId = args.followUpId ? String(args.followUpId).trim() : '';
  if (!followUpId) return { ok: false, error: 'followUpId_required' };
  if (!hasCrmFollowUpModel(prisma)) {
    return {
      ok: false,
      error: 'crm_follow_up_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  let row = null;
  try {
    row = await prisma.crmFollowUp.findUnique({ where: { id: followUpId } });
  } catch {
    row = null;
  }
  if (!row) return { ok: false, notFound: true, error: 'follow_up_not_found' };

  if (row.status === CRM_FOLLOW_UP_STATUS.COMPLETED) {
    return {
      ok: true,
      followUp: serializeFollowUp(row),
      alreadyCompleted: true,
    };
  }
  if (!OPENISH.has(row.status) && row.status !== CRM_FOLLOW_UP_STATUS.PLANNED) {
    return { ok: false, error: 'invalid_follow_up_status', status: row.status };
  }

  const now = args.now || new Date();
  const updated = await prisma.crmFollowUp.update({
    where: { id: row.id },
    data: {
      status: CRM_FOLLOW_UP_STATUS.COMPLETED,
      completedAt: now,
      updatedAt: now,
    },
  });

  await recordFollowUpHistory(prisma, {
    followUpId: row.id,
    fromStatus: row.status,
    toStatus: CRM_FOLLOW_UP_STATUS.COMPLETED,
    dueAt: row.dueAt,
    changedByAdminId: args.admin?.id || null,
    reason: 'completed',
    at: now,
  });

  if (row.activityId && hasCrmActivityModel(prisma)) {
    await transitionActivityStatus(prisma, {
      admin: args.admin,
      activityId: row.activityId,
      toStatus: CRM_ACTIVITY_STATUS.COMPLETED,
      reason: 'follow_up_completed',
      now,
    });
  }

  await appendTimelineEvent(prisma, {
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    eventType: CRM_TIMELINE_EVENT_TYPE.FOLLOW_UP_COMPLETED,
    summary: `Follow-Up completed: ${String(row.title || '').slice(0, 120)}`,
    payload: {
      followUpId: row.id,
      activityId: row.activityId,
      status: CRM_FOLLOW_UP_STATUS.COMPLETED,
    },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return { ok: true, followUp: serializeFollowUp(updated) };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, followUpId: string, dueAt: Date|string, now?: Date }} args
 */
export async function rescheduleFollowUp(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canEditActivities &&
    !access.canEditLeads &&
    !access.canEditOpportunities
  ) {
    return { ok: false, forbidden: true, reason: 'crm_follow_up_reschedule_forbidden' };
  }

  const followUpId = args.followUpId ? String(args.followUpId).trim() : '';
  const dueAt = args.dueAt ? new Date(args.dueAt) : null;
  if (!followUpId) return { ok: false, error: 'followUpId_required' };
  if (!dueAt || Number.isNaN(dueAt.getTime())) {
    return { ok: false, error: 'dueAt_required' };
  }
  if (!hasCrmFollowUpModel(prisma)) {
    return {
      ok: false,
      error: 'crm_follow_up_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  let row = null;
  try {
    row = await prisma.crmFollowUp.findUnique({ where: { id: followUpId } });
  } catch {
    row = null;
  }
  if (!row) return { ok: false, notFound: true, error: 'follow_up_not_found' };
  if (row.status === CRM_FOLLOW_UP_STATUS.COMPLETED) {
    return { ok: false, error: 'follow_up_already_completed' };
  }
  if (row.status === CRM_FOLLOW_UP_STATUS.CANCELLED) {
    return { ok: false, error: 'follow_up_cancelled' };
  }

  const now = args.now || new Date();
  const updated = await prisma.crmFollowUp.update({
    where: { id: row.id },
    data: { dueAt, updatedAt: now },
  });

  if (row.activityId && hasCrmActivityModel(prisma)) {
    try {
      await prisma.crmActivity.update({
        where: { id: row.activityId },
        data: { dueAt, updatedAt: now },
      });
    } catch {
      // best-effort
    }
  }

  await recordFollowUpHistory(prisma, {
    followUpId: row.id,
    fromStatus: row.status,
    toStatus: row.status,
    dueAt,
    changedByAdminId: args.admin?.id || null,
    reason: 'rescheduled',
    at: now,
  });

  await appendTimelineEvent(prisma, {
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    eventType: CRM_TIMELINE_EVENT_TYPE.FOLLOW_UP_RESCHEDULED,
    summary: `Follow-Up rescheduled: ${String(row.title || '').slice(0, 100)}`,
    payload: {
      followUpId: row.id,
      activityId: row.activityId,
      previousDueAt: row.dueAt ? new Date(row.dueAt).toISOString() : null,
      dueAt: dueAt.toISOString(),
    },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return { ok: true, followUp: serializeFollowUp(updated) };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   subjectType?: string,
 *   subjectId?: string,
 *   status?: string,
 *   limit?: number|string,
 *   offset?: number|string,
 * }} args
 */
export async function listFollowUps(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canViewActivities &&
    !access.canViewLeads &&
    !access.canViewOpportunities
  ) {
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_follow_up_view_forbidden',
      items: [],
    };
  }

  if (!hasCrmFollowUpModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'crm_follow_up_model_unavailable', count: 0 },
    };
  }

  const where = {};
  if (args.subjectType) {
    where.subjectType = String(args.subjectType).trim().toUpperCase();
  }
  if (args.subjectId) where.subjectId = String(args.subjectId).trim();
  if (args.status) where.status = String(args.status).trim().toUpperCase();

  const rawLimit = Number(args.limit);
  const limit = Math.min(
    CRM_LIST_MAX_LIMIT,
    Math.max(1, Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : CRM_LIST_DEFAULT_LIMIT)
  );
  const rawOffset = Number(args.offset);
  const offset =
    Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  let rows = [];
  try {
    rows = await prisma.crmFollowUp.findMany({
      where,
      orderBy: { dueAt: 'asc' },
      take: limit,
      skip: offset > 0 ? offset : undefined,
    });
  } catch {
    rows = [];
  }

  return {
    ok: true,
    items: (rows || []).map(serializeFollowUp),
    meta: { count: (rows || []).length, limit, offset },
  };
}

export { serializeFollowUp, CRM_FOLLOW_UP_STATUS };
