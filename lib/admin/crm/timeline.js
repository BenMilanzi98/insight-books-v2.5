/**
 * CRM timeline — Phase 11 Wave 4 foundations.
 * Paginated activity for Lead / Account / Contact. Never projects Support/CS threads.
 */

import {
  CRM_LIST_DEFAULT_LIMIT,
  CRM_LIST_MAX_LIMIT,
  CRM_SUBJECT_TYPE,
  CRM_SUBJECT_TYPES,
  CRM_TIMELINE_EVENT_TYPE,
} from './catalogue.js';
import { resolveCrmAccess } from './authz.js';

const SUBJECT_SET = new Set(CRM_SUBJECT_TYPES);

export function hasCrmTimelineEventModel(prisma) {
  return typeof prisma?.crmTimelineEvent?.findMany === 'function';
}

function serializeTimelineEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    eventType: row.eventType,
    summary: row.summary || null,
    payload: row.payload ?? null,
    actorAdminId: row.actorAdminId || null,
    at: row.at ? new Date(row.at).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

/**
 * Append a timeline event (best-effort when model unavailable).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   subjectType: string,
 *   subjectId: string,
 *   eventType: string,
 *   summary?: string|null,
 *   payload?: object|null,
 *   actorAdminId?: string|null,
 *   at?: Date,
 * }} args
 */
export async function appendTimelineEvent(prisma, args = {}) {
  if (!hasCrmTimelineEventModel(prisma)) {
    return { ok: true, skipped: true, reason: 'crm_timeline_model_unavailable' };
  }

  const subjectType = String(args.subjectType || '').trim().toUpperCase();
  const subjectId = args.subjectId ? String(args.subjectId).trim() : '';
  const eventType = String(args.eventType || CRM_TIMELINE_EVENT_TYPE.SYSTEM)
    .trim()
    .toUpperCase();

  if (!SUBJECT_SET.has(subjectType) || !subjectId) {
    return { ok: false, error: 'subjectType_and_subjectId_required' };
  }

  const now = args.at || new Date();
  const row = await prisma.crmTimelineEvent.create({
    data: {
      subjectType,
      subjectId,
      eventType,
      summary: args.summary != null ? String(args.summary).slice(0, 2000) : null,
      payload: args.payload ?? undefined,
      actorAdminId: args.actorAdminId || null,
      at: now,
      createdAt: now,
    },
  });

  return { ok: true, event: serializeTimelineEvent(row) };
}

/**
 * Paginated timeline for a subject.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   subjectType: string,
 *   subjectId: string,
 *   limit?: number|string,
 *   offset?: number|string,
 *   cursor?: string,
 * }} args
 */
export async function listTimeline(prisma, args = {}) {
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

  const subjectType = String(args.subjectType || CRM_SUBJECT_TYPE.LEAD)
    .trim()
    .toUpperCase();
  const subjectId = args.subjectId ? String(args.subjectId).trim() : '';
  if (!SUBJECT_SET.has(subjectType) || !subjectId) {
    return { ok: false, error: 'subjectType_and_subjectId_required', items: [] };
  }

  if (!hasCrmTimelineEventModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, reason: 'crm_timeline_model_unavailable', count: 0 },
    };
  }

  const rawLimit = Number(args.limit);
  const limit = Math.min(
    CRM_LIST_MAX_LIMIT,
    Math.max(1, Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : CRM_LIST_DEFAULT_LIMIT)
  );
  const rawOffset = Number(args.offset);
  const offset =
    Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  const query = {
    where: { subjectType, subjectId },
    orderBy: { at: 'desc' },
    take: limit,
  };
  if (args.cursor) {
    query.cursor = { id: String(args.cursor) };
    query.skip = 1;
  } else if (offset > 0) {
    query.skip = offset;
  }

  let rows = [];
  try {
    rows = await prisma.crmTimelineEvent.findMany(query);
  } catch {
    rows = [];
  }

  return {
    ok: true,
    items: (rows || []).map(serializeTimelineEvent),
    meta: {
      count: (rows || []).length,
      limit,
      offset,
      cursor: args.cursor || null,
      subjectType,
      subjectId,
    },
  };
}

export { serializeTimelineEvent, CRM_TIMELINE_EVENT_TYPE };
