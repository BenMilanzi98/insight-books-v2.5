/**
 * CRM tasks — Phase 11 Wave 4 + Phase 13 Wave 1 Activity link.
 * TODO → COMPLETED; reopen COMPLETED → TODO. Due date ≠ complete.
 * Creating a Task creates/links CrmActivity type TASK (when model available).
 * Never aliases CsTask.
 */

import {
  CRM_ACTIVITY_DIRECTION,
  CRM_ACTIVITY_STATUS,
  CRM_ACTIVITY_TYPE,
  CRM_LIST_DEFAULT_LIMIT,
  CRM_LIST_MAX_LIMIT,
  CRM_SUBJECT_TYPE,
  CRM_SUBJECT_TYPES,
  CRM_TASK_STATUS,
  CRM_TASK_STATUSES,
  CRM_TIMELINE_EVENT_TYPE,
} from './catalogue.js';
import { resolveCrmAccess } from './authz.js';
import { appendTimelineEvent } from './timeline.js';
import {
  allocateTaskNumber,
  createCrmActivity,
  hasCrmActivityModel,
  transitionActivityStatus,
} from './activities/index.js';

const SUBJECT_SET = new Set(
  CRM_SUBJECT_TYPES.filter((s) => s !== CRM_SUBJECT_TYPE.ACTIVITY)
);
const STATUS_SET = new Set(CRM_TASK_STATUSES);

export function hasCrmTaskModel(prisma) {
  return typeof prisma?.crmTask?.findMany === 'function';
}

function serializeTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    activityId: row.activityId || null,
    taskNumber: row.taskNumber || null,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    title: row.title,
    status: row.status,
    dueAt: row.dueAt ? new Date(row.dueAt).toISOString() : null,
    assigneeAdminId: row.assigneeAdminId || null,
    createdByAdminId: row.createdByAdminId || null,
    completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   subjectType?: string,
 *   subjectId: string,
 *   title: string,
 *   dueAt?: Date|string|null,
 *   assigneeAdminId?: string|null,
 *   allocateTaskNumber?: boolean,
 *   now?: Date,
 * }} args
 */
export async function createTask(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canEditLeads &&
    !access.canCreateLeads &&
    !access.canEditOpportunities &&
    !access.canEditActivities
  ) {
    return { ok: false, forbidden: true, reason: 'crm_task_create_forbidden' };
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

  if (!hasCrmTaskModel(prisma)) {
    return { ok: false, error: 'crm_task_model_unavailable', status: 'UNAVAILABLE' };
  }

  const now = args.now || new Date();
  const dueAt = args.dueAt ? new Date(args.dueAt) : null;

  let activity = null;
  if (hasCrmActivityModel(prisma)) {
    const actResult = await createCrmActivity(prisma, {
      admin: args.admin,
      type: CRM_ACTIVITY_TYPE.TASK,
      status: CRM_ACTIVITY_STATUS.OPEN,
      direction: CRM_ACTIVITY_DIRECTION.INTERNAL,
      title,
      ownerAdminId: args.assigneeAdminId || args.admin?.id || null,
      dueAt: dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null,
      primarySubjectType: subjectType,
      primarySubjectId: subjectId,
      now,
    });
    // Fail closed when Activity model is present — never create orphan Task without Activity
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

  let taskNumber = null;
  if (args.allocateTaskNumber) {
    const num = await allocateTaskNumber(prisma, { now });
    if (num.ok) taskNumber = num.number;
  }

  const row = await prisma.crmTask.create({
    data: {
      activityId: activity?.id || null,
      taskNumber: taskNumber || undefined,
      subjectType,
      subjectId,
      title,
      status: CRM_TASK_STATUS.TODO,
      dueAt: dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null,
      assigneeAdminId: args.assigneeAdminId || args.admin?.id || null,
      createdByAdminId: args.admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  await appendTimelineEvent(prisma, {
    subjectType,
    subjectId,
    eventType: CRM_TIMELINE_EVENT_TYPE.TASK_CREATED,
    summary: `Task created: ${title.slice(0, 120)}`,
    payload: {
      taskId: row.id,
      activityId: activity?.id || null,
      taskNumber: taskNumber || null,
      status: CRM_TASK_STATUS.TODO,
    },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return {
    ok: true,
    task: serializeTask(row),
    activity,
  };
}

/**
 * Complete a TODO task (TODO → COMPLETED). Idempotent if already COMPLETED.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, taskId: string, now?: Date }} args
 */
export async function completeTask(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canEditLeads &&
    !access.canEditOpportunities &&
    !access.canEditActivities
  ) {
    return { ok: false, forbidden: true, reason: 'crm_task_complete_forbidden' };
  }

  const taskId = args.taskId ? String(args.taskId).trim() : '';
  if (!taskId) return { ok: false, error: 'taskId_required' };
  if (!hasCrmTaskModel(prisma)) {
    return { ok: false, error: 'crm_task_model_unavailable', status: 'UNAVAILABLE' };
  }

  let row = null;
  try {
    row = await prisma.crmTask.findUnique({ where: { id: taskId } });
  } catch {
    row = null;
  }
  if (!row) return { ok: false, notFound: true, error: 'task_not_found' };

  if (row.status === CRM_TASK_STATUS.COMPLETED) {
    return { ok: true, task: serializeTask(row), alreadyCompleted: true };
  }
  if (row.status !== CRM_TASK_STATUS.TODO) {
    return { ok: false, error: 'invalid_task_status', status: row.status };
  }

  const now = args.now || new Date();
  const updated = await prisma.crmTask.update({
    where: { id: row.id },
    data: {
      status: CRM_TASK_STATUS.COMPLETED,
      completedAt: now,
      updatedAt: now,
    },
  });

  if (row.activityId && hasCrmActivityModel(prisma)) {
    await transitionActivityStatus(prisma, {
      admin: args.admin,
      activityId: row.activityId,
      toStatus: CRM_ACTIVITY_STATUS.COMPLETED,
      reason: 'task_completed',
      now,
    });
  }

  await appendTimelineEvent(prisma, {
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    eventType: CRM_TIMELINE_EVENT_TYPE.TASK_COMPLETED,
    summary: `Task completed: ${String(row.title || '').slice(0, 120)}`,
    payload: {
      taskId: row.id,
      activityId: row.activityId || null,
      status: CRM_TASK_STATUS.COMPLETED,
    },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return { ok: true, task: serializeTask(updated) };
}

/**
 * Reopen COMPLETED → TODO and sync Activity status when linked.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, taskId: string, now?: Date }} args
 */
export async function reopenTask(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canEditLeads &&
    !access.canEditOpportunities &&
    !access.canEditActivities
  ) {
    return { ok: false, forbidden: true, reason: 'crm_task_reopen_forbidden' };
  }

  const taskId = args.taskId ? String(args.taskId).trim() : '';
  if (!taskId) return { ok: false, error: 'taskId_required' };
  if (!hasCrmTaskModel(prisma)) {
    return { ok: false, error: 'crm_task_model_unavailable', status: 'UNAVAILABLE' };
  }

  let row = null;
  try {
    row = await prisma.crmTask.findUnique({ where: { id: taskId } });
  } catch {
    row = null;
  }
  if (!row) return { ok: false, notFound: true, error: 'task_not_found' };

  if (row.status === CRM_TASK_STATUS.TODO) {
    return { ok: true, task: serializeTask(row), alreadyOpen: true };
  }
  if (row.status !== CRM_TASK_STATUS.COMPLETED) {
    return { ok: false, error: 'invalid_task_status', status: row.status };
  }

  const now = args.now || new Date();
  const updated = await prisma.crmTask.update({
    where: { id: row.id },
    data: {
      status: CRM_TASK_STATUS.TODO,
      completedAt: null,
      updatedAt: now,
    },
  });

  if (row.activityId && hasCrmActivityModel(prisma)) {
    await transitionActivityStatus(prisma, {
      admin: args.admin,
      activityId: row.activityId,
      toStatus: CRM_ACTIVITY_STATUS.OPEN,
      reason: 'task_reopened',
      now,
    });
  }

  await appendTimelineEvent(prisma, {
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    eventType: CRM_TIMELINE_EVENT_TYPE.TASK_REOPENED,
    summary: `Task reopened: ${String(row.title || '').slice(0, 120)}`,
    payload: {
      taskId: row.id,
      activityId: row.activityId || null,
      status: CRM_TASK_STATUS.TODO,
    },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return { ok: true, task: serializeTask(updated) };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   subjectType?: string,
 *   subjectId?: string,
 *   assigneeAdminId?: string|null,
 *   status?: string,
 *   myWork?: boolean,
 *   activityId?: string,
 *   limit?: number|string,
 *   offset?: number|string,
 * }} args
 */
export async function listTasks(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canViewLeads &&
    !access.canViewAccounts &&
    !access.canViewContacts &&
    !access.canViewOpportunities &&
    !access.canViewActivities
  ) {
    return { ok: false, forbidden: true, reason: 'crm_view_forbidden', items: [] };
  }

  if (!hasCrmTaskModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'crm_task_model_unavailable', count: 0 },
    };
  }

  const where = {};
  if (args.subjectType) {
    where.subjectType = String(args.subjectType).trim().toUpperCase();
  }
  if (args.subjectId) where.subjectId = String(args.subjectId).trim();
  if (args.activityId) where.activityId = String(args.activityId).trim();
  if (args.status) {
    const status = String(args.status).trim().toUpperCase();
    if (!STATUS_SET.has(status)) {
      return { ok: false, error: 'invalid_task_status', items: [] };
    }
    where.status = status;
  }
  if (args.myWork === true && args.admin?.id) {
    where.assigneeAdminId = String(args.admin.id);
  } else if (args.assigneeAdminId) {
    where.assigneeAdminId = String(args.assigneeAdminId);
  }

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
    rows = await prisma.crmTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset > 0 ? offset : undefined,
    });
  } catch {
    rows = [];
  }

  return {
    ok: true,
    items: (rows || []).map(serializeTask),
    meta: { count: (rows || []).length, limit, offset },
  };
}

export { serializeTask, CRM_TASK_STATUS };
