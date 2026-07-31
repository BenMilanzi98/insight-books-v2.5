/**
 * CRM Reminders — Phase 13 Wave 4.
 * Dedupe: ruleKey + activityId + recipient + occurrence + channel.
 * Delivery ≠ Activity complete. Reminder ≠ Sales contact / billing subscription reminder.
 */

import {
  CRM_LIST_DEFAULT_LIMIT,
  CRM_LIST_MAX_LIMIT,
  CRM_REMINDER_CHANNEL,
  CRM_REMINDER_CHANNELS,
  CRM_REMINDER_STATUS,
} from './catalogue.js';
import { resolveCrmAccess } from './authz.js';

const CHANNEL_SET = new Set(CRM_REMINDER_CHANNELS);

export function hasCrmReminderModel(prisma) {
  return typeof prisma?.crmReminder?.create === 'function';
}

/**
 * Stable dedupe identity for Reminder occurrences.
 * @param {{
 *   ruleKey: string,
 *   activityId: string,
 *   recipientAdminId: string,
 *   occurrenceKey: string,
 *   channel: string,
 * }} parts
 */
export function buildReminderDedupeKey(parts = {}) {
  const ruleKey = String(parts.ruleKey || '').trim().toUpperCase();
  const activityId = String(parts.activityId || '').trim();
  const recipientAdminId = String(parts.recipientAdminId || '').trim();
  const occurrenceKey = String(parts.occurrenceKey || '').trim();
  const channel = String(parts.channel || CRM_REMINDER_CHANNEL.IN_APP)
    .trim()
    .toUpperCase();
  return [ruleKey, activityId, recipientAdminId, occurrenceKey, channel].join('|');
}

function serializeReminder(row) {
  if (!row) return null;
  return {
    id: row.id,
    dedupeKey: row.dedupeKey,
    ruleKey: row.ruleKey,
    activityId: row.activityId || null,
    recipientAdminId: row.recipientAdminId || null,
    channel: row.channel,
    occurrenceKey: row.occurrenceKey,
    status: row.status,
    dueAt: row.dueAt ? new Date(row.dueAt).toISOString() : null,
    snoozeUntil: row.snoozeUntil ? new Date(row.snoozeUntil).toISOString() : null,
    deliveredAt: row.deliveredAt ? new Date(row.deliveredAt).toISOString() : null,
    activityCompletedByDelivery: false,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   ruleKey: string,
 *   activityId: string,
 *   recipientAdminId: string,
 *   occurrenceKey: string,
 *   channel?: string,
 *   dueAt: Date|string,
 *   now?: Date,
 * }} args
 */
export async function scheduleReminder(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canEditActivities && !access.canEditLeads && !access.canEditOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_reminder_schedule_forbidden' };
  }

  if (!hasCrmReminderModel(prisma)) {
    return {
      ok: false,
      error: 'crm_reminder_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const ruleKey = args.ruleKey != null ? String(args.ruleKey).trim().toUpperCase() : '';
  const activityId = args.activityId ? String(args.activityId).trim() : '';
  const recipientAdminId = args.recipientAdminId
    ? String(args.recipientAdminId).trim()
    : args.admin?.id
      ? String(args.admin.id)
      : '';
  const occurrenceKey =
    args.occurrenceKey != null ? String(args.occurrenceKey).trim() : '';
  const channel = String(args.channel || CRM_REMINDER_CHANNEL.IN_APP)
    .trim()
    .toUpperCase();

  if (!ruleKey) return { ok: false, error: 'ruleKey_required' };
  if (!activityId) return { ok: false, error: 'activityId_required' };
  if (!recipientAdminId) return { ok: false, error: 'recipientAdminId_required' };
  if (!occurrenceKey) return { ok: false, error: 'occurrenceKey_required' };
  if (!CHANNEL_SET.has(channel)) {
    return { ok: false, error: 'invalid_channel', allowed: CRM_REMINDER_CHANNELS };
  }
  if (!args.dueAt) return { ok: false, error: 'dueAt_required' };

  const dueAt = new Date(args.dueAt);
  if (Number.isNaN(dueAt.getTime())) return { ok: false, error: 'invalid_dueAt' };

  const dedupeKey = buildReminderDedupeKey({
    ruleKey,
    activityId,
    recipientAdminId,
    occurrenceKey,
    channel,
  });

  try {
    const existing = await prisma.crmReminder.findUnique({ where: { dedupeKey } });
    if (existing) {
      return {
        ok: true,
        reminder: serializeReminder(existing),
        dedupe: true,
        meta: {
          activityCompletedByDelivery: false,
          inventDeliveryForbidden: true,
        },
      };
    }
  } catch {
    // fall through to create
  }

  const now = args.now || new Date();
  const row = await prisma.crmReminder.create({
    data: {
      dedupeKey,
      ruleKey,
      activityId,
      recipientAdminId,
      channel,
      occurrenceKey,
      status: CRM_REMINDER_STATUS.SCHEDULED,
      dueAt,
      createdByAdminId: args.admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    reminder: serializeReminder(row),
    dedupe: false,
    meta: {
      activityCompletedByDelivery: false,
      inventDeliveryForbidden: true,
    },
  };
}

/**
 * Queue due SCHEDULED/SNOOZED reminders (status → QUEUED). Does not deliver or complete Activities.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, now?: Date, limit?: number }} args
 */
export async function queueDueReminders(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canEditActivities && !access.canEditLeads && !access.isSuperAdmin) {
    return { ok: false, forbidden: true, reason: 'crm_reminder_queue_forbidden', items: [] };
  }

  if (!hasCrmReminderModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'crm_reminder_model_unavailable', status: 'UNAVAILABLE' },
    };
  }

  const now = args.now || new Date();
  const limit = Math.min(100, Math.max(1, Number(args.limit) || 50));
  let rows = [];
  try {
    rows = await prisma.crmReminder.findMany({
      where: {
        status: { in: [CRM_REMINDER_STATUS.SCHEDULED, CRM_REMINDER_STATUS.SNOOZED] },
        dueAt: { lte: now },
      },
      take: limit,
      orderBy: { dueAt: 'asc' },
    });
  } catch {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'reminder_query_failed', status: 'UNAVAILABLE' },
    };
  }

  const queued = [];
  for (const row of rows) {
    if (
      row.status === CRM_REMINDER_STATUS.SNOOZED &&
      row.snoozeUntil &&
      new Date(row.snoozeUntil) > now
    ) {
      continue;
    }
    try {
      const updated = await prisma.crmReminder.update({
        where: { id: row.id },
        data: { status: CRM_REMINDER_STATUS.QUEUED, updatedAt: now },
      });
      queued.push(serializeReminder(updated));
    } catch {
      // skip row
    }
  }

  return {
    ok: true,
    items: queued,
    meta: {
      count: queued.length,
      activityCompletedByDelivery: false,
      inventDeliveryForbidden: true,
    },
  };
}

/**
 * Mark reminder delivered. Never transitions linked Activity to COMPLETED.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, reminderId: string, now?: Date }} args
 */
export async function markReminderDelivered(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canEditActivities && !access.canEditLeads && !access.isSuperAdmin) {
    return { ok: false, forbidden: true, reason: 'crm_reminder_deliver_forbidden' };
  }

  if (!hasCrmReminderModel(prisma)) {
    return {
      ok: false,
      error: 'crm_reminder_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const reminderId = args.reminderId ? String(args.reminderId).trim() : '';
  if (!reminderId) return { ok: false, error: 'reminderId_required' };

  let row = null;
  try {
    row = await prisma.crmReminder.findUnique({ where: { id: reminderId } });
  } catch {
    row = null;
  }
  if (!row) return { ok: false, notFound: true, error: 'reminder_not_found' };

  const now = args.now || new Date();
  const updated = await prisma.crmReminder.update({
    where: { id: reminderId },
    data: {
      status: CRM_REMINDER_STATUS.DELIVERED,
      deliveredAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    reminder: serializeReminder(updated),
    meta: {
      activityCompletedByDelivery: false,
      activityStatusUnchanged: true,
      inventDeliveryForbidden: true,
    },
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, reminderId: string, snoozeUntil: Date|string, now?: Date }} args
 */
export async function snoozeReminder(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canEditActivities && !access.canEditLeads && !access.isSuperAdmin) {
    return { ok: false, forbidden: true, reason: 'crm_reminder_snooze_forbidden' };
  }

  if (!hasCrmReminderModel(prisma)) {
    return {
      ok: false,
      error: 'crm_reminder_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const reminderId = args.reminderId ? String(args.reminderId).trim() : '';
  if (!reminderId) return { ok: false, error: 'reminderId_required' };
  if (!args.snoozeUntil) return { ok: false, error: 'snoozeUntil_required' };

  const snoozeUntil = new Date(args.snoozeUntil);
  if (Number.isNaN(snoozeUntil.getTime())) return { ok: false, error: 'invalid_snoozeUntil' };

  let row = null;
  try {
    row = await prisma.crmReminder.findUnique({ where: { id: reminderId } });
  } catch {
    row = null;
  }
  if (!row) return { ok: false, notFound: true, error: 'reminder_not_found' };

  const now = args.now || new Date();
  const updated = await prisma.crmReminder.update({
    where: { id: reminderId },
    data: {
      status: CRM_REMINDER_STATUS.SNOOZED,
      snoozeUntil,
      dueAt: snoozeUntil,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    reminder: serializeReminder(updated),
    meta: { activityCompletedByDelivery: false },
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   activityId?: string,
 *   recipientAdminId?: string,
 *   status?: string,
 *   limit?: number|string,
 * }} args
 */
export async function listReminders(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (
    !access.canViewActivities &&
    !access.canViewLeads &&
    !access.canViewOpportunities
  ) {
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_reminder_list_forbidden',
      items: [],
    };
  }

  if (!hasCrmReminderModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'crm_reminder_model_unavailable', status: 'UNAVAILABLE' },
    };
  }

  const where = {};
  if (args.activityId) where.activityId = String(args.activityId).trim();
  if (args.recipientAdminId) where.recipientAdminId = String(args.recipientAdminId).trim();
  if (args.status) where.status = String(args.status).trim().toUpperCase();

  const limit = Math.min(
    CRM_LIST_MAX_LIMIT,
    Math.max(1, Number(args.limit) || CRM_LIST_DEFAULT_LIMIT)
  );

  let rows = [];
  try {
    rows = await prisma.crmReminder.findMany({
      where,
      orderBy: { dueAt: 'asc' },
      take: limit,
    });
  } catch {
    rows = [];
  }

  return {
    ok: true,
    items: (rows || []).map(serializeReminder),
    meta: {
      count: (rows || []).length,
      activityCompletedByDelivery: false,
      inventDeliveryForbidden: true,
    },
  };
}

export { serializeReminder };
